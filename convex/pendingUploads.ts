import { internal } from "./_generated/api";
import {
  internalMutation,
  type MutationCtx,
  mutation,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";

export const PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

const requireAuthUser = async (ctx: MutationCtx) => {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) {
    throw new ConvexError("Unauthorized");
  }
  return user;
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
    sessionIds: v.array(v.id("pendingUploads")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);

    for (const sessionId of args.sessionIds) {
      const session = await ctx.db.get(sessionId);
      if (!session || session.userId !== user._id) {
        continue;
      }
      if (session.storageId !== undefined) {
        await ctx.storage.delete(session.storageId);
      }
      await ctx.db.delete(sessionId);
    }

    return null;
  },
});

export const cleanupExpired = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
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
      });
    }

    return null;
  },
});
