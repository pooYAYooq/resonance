import { internal } from "./_generated/api";
import {
  internalMutation,
  type MutationCtx,
  mutation,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import type { Id } from "./_generated/dataModel";
import {
  isAllowedInlineImageType,
  MAX_INLINE_IMAGE_SIZE_BYTES,
} from "../lib/inline-image";

export const PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;
const MAX_CLEANUP_REQUEST_SIZE = 100;
const CLEANUP_LEASE_MS = 30 * 60 * 1000;

const requireAuthUser = async (ctx: MutationCtx) => {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) {
    throw new ConvexError("Unauthorized");
  }
  return user;
};

const isValidUploadedImage = async (
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  createdAt: number,
  now: number,
) => {
  const metadata = await ctx.db.system.get("_storage", storageId);
  return !!(
    metadata &&
    metadata._creationTime >= createdAt &&
    metadata._creationTime <= now &&
    metadata.contentType &&
    isAllowedInlineImageType(metadata.contentType) &&
    metadata.size <= MAX_INLINE_IMAGE_SIZE_BYTES
  );
};

export const createPendingUpload = mutation({
  args: {},
  returns: v.object({
    sessionId: v.id("pendingUploads"),
    uploadUrl: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireAuthUser(ctx);
    const createdAt = Date.now();
    const expiresAt = createdAt + PENDING_UPLOAD_TTL_MS;
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const sessionId = await ctx.db.insert("pendingUploads", {
      userId: user._id,
      createdAt,
      expiresAt,
    });

    return { sessionId, uploadUrl, expiresAt };
  },
});

export const finalizePendingUpload = mutation({
  args: {
    sessionId: v.id("pendingUploads"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new ConvexError("Invalid inline upload session");
    }
    if (session.expiresAt <= Date.now()) {
      throw new ConvexError("Inline image expired");
    }
    if (
      !(await isValidUploadedImage(
        ctx,
        args.storageId,
        session.createdAt,
        Date.now(),
      ))
    ) {
      throw new ConvexError("Invalid inline upload session");
    }
    const existingClaims = await ctx.db
      .query("pendingUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .take(2);
    if (existingClaims.some((claim) => claim._id !== args.sessionId)) {
      throw new ConvexError("Invalid inline upload session");
    }
    if (
      session.storageId !== undefined &&
      session.storageId !== args.storageId
    ) {
      throw new ConvexError("Invalid inline upload session");
    }
    if (session.storageId === undefined) {
      await ctx.db.patch(args.sessionId, { storageId: args.storageId });
    }

    return null;
  },
});

export const cleanupPending = mutation({
  args: {
    uploads: v.array(
      v.object({
        sessionId: v.id("pendingUploads"),
        storageId: v.optional(v.id("_storage")),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.uploads.length > MAX_CLEANUP_REQUEST_SIZE) {
      throw new ConvexError("Too many inline uploads to clean up");
    }
    const user = await requireAuthUser(ctx);

    for (const upload of args.uploads) {
      const session = await ctx.db.get(upload.sessionId);
      if (!session || session.userId !== user._id) {
        continue;
      }
      if (session.consumedAt !== undefined) {
        continue;
      }
      if (session.storageId !== undefined) {
        await ctx.storage.delete(session.storageId);
      } else {
        const storageId = upload.storageId;
        if (
          storageId !== undefined &&
          (await isValidUploadedImage(
            ctx,
            storageId,
            session.createdAt,
            Date.now(),
          ))
        ) {
          await ctx.storage.delete(storageId);
        }
      }
      await ctx.db.delete(upload.sessionId);
    }

    return null;
  },
});

export const cleanupExpired = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    runId: v.optional(v.id("pendingUploadCleanupLocks")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    let runId = args.runId;
    if (runId === undefined) {
      const existingLock = await ctx.db
        .query("pendingUploadCleanupLocks")
        .withIndex("by_key", (q) => q.eq("key", "pending-inline-uploads"))
        .unique();
      if (existingLock && existingLock.lockedUntil > now) {
        return null;
      }
      if (existingLock) {
        runId = existingLock._id;
        await ctx.db.patch(runId, { lockedUntil: now + CLEANUP_LEASE_MS });
      } else {
        runId = await ctx.db.insert("pendingUploadCleanupLocks", {
          key: "pending-inline-uploads",
          lockedUntil: now + CLEANUP_LEASE_MS,
        });
      }
    } else {
      const lock = await ctx.db.get(runId);
      if (!lock || lock.lockedUntil <= now) {
        return null;
      }
      await ctx.db.patch(runId, { lockedUntil: now + CLEANUP_LEASE_MS });
    }
    const page = await ctx.db
      .query("pendingUploads")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .paginate({ numItems: CLEANUP_BATCH_SIZE, cursor: args.cursor });

    for (const session of page.page) {
      if (session.storageId !== undefined) {
        await ctx.storage.delete(session.storageId);
      }
      await ctx.db.delete(session._id);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.pendingUploads.cleanupExpired, {
        cursor: page.continueCursor,
        runId,
      });
    } else {
      await ctx.db.delete(runId);
    }

    return null;
  },
});
