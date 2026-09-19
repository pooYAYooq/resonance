import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import type { Id } from "./_generated/dataModel";
import { extractImageStorageIds, parsePostBody } from "../lib/post-content";

export const SESSION_MEDIA_CLAIM_TTL_MS = 60 * 60 * 1000;
export const SESSION_MEDIA_RENEW_INTERVAL_MS = 5 * 60 * 1000;
const MAX_SESSION_MEDIA_BATCH = 100;

const requireAuthUser = async (ctx: MutationCtx) => {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new ConvexError("Unauthorized");
  return user;
};

function assertBatchSize(storageIds: readonly Id<"_storage">[]) {
  if (storageIds.length > MAX_SESSION_MEDIA_BATCH) {
    throw new ConvexError("Too many media claims");
  }
}

async function hasOwnedPendingAsset(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
  storageId: Id<"_storage">,
  now: number,
): Promise<boolean> {
  // Bounded read, never paginated: Convex allows a single `.paginate()` per
  // function, and this helper runs inside paginated cleanup handlers.
  const claims = await ctx.db
    .query("pendingUploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .order("desc")
    .take(MAX_SESSION_MEDIA_BATCH);
  for (const claim of claims) {
    if (claim.userId !== userId) continue;
    if (claim.consumedAt === undefined && claim.expiresAt > now) {
      return true;
    }
    if (
      claim.postId !== undefined &&
      (await ownedPostReferencesStorage(ctx, userId, claim.postId, storageId))
    ) {
      return true;
    }
  }
  return false;
}

async function ownedPostReferencesStorage(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
  postId: Id<"posts">,
  storageId: Id<"_storage">,
): Promise<boolean> {
  const post = await ctx.db.get(postId);
  if (!post || post.authorId !== userId) return false;
  if (post.imageStorageId === storageId) return true;
  const parsedBody = parsePostBody(post.body);
  return (
    parsedBody.kind === "structured" &&
    (
      extractImageStorageIds(parsedBody.document.blocks) as Id<"_storage">[]
    ).includes(storageId)
  );
}

async function getSessionClaim(
  ctx: MutationCtx,
  userId: string,
  sessionId: string,
  storageId: Id<"_storage">,
) {
  return ctx.db
    .query("sessionMediaClaims")
    .withIndex("by_userId_and_sessionId_and_storageId", (q) =>
      q
        .eq("userId", userId)
        .eq("sessionId", sessionId)
        .eq("storageId", storageId),
    )
    .unique();
}

export async function hasActiveSessionMediaClaim(
  ctx: Pick<MutationCtx, "db">,
  storageId: Id<"_storage">,
  now = Date.now(),
): Promise<boolean> {
  // Bounded, non-paginated read. This helper is called from handlers that
  // already own the function's single paginated query (pending uploads and
  // post-deletion cleanup), so it must never call `.paginate()`.
  //
  // Terminal claims (released or consumed) are stored with `expiresAt: 0`, so
  // the index range only contains live, unexpired claims. That makes this
  // existence check exhaustive even when a storage object has many historical
  // claims; a newest-first scan could hide an older active claim.
  const claims = await ctx.db
    .query("sessionMediaClaims")
    .withIndex("by_storageId_and_expiresAt", (q) =>
      q.eq("storageId", storageId).gt("expiresAt", now),
    )
    .take(MAX_SESSION_MEDIA_BATCH);
  return claims.some(
    (claim) => claim.releasedAt === undefined && claim.consumedAt === undefined,
  );
}

export async function consumeSessionMediaClaims(
  ctx: MutationCtx,
  userId: string,
  storageIds: readonly Id<"_storage">[],
  consumedAt = Date.now(),
): Promise<void> {
  const uniqueStorageIds = [...new Set(storageIds)];
  for (const storageId of uniqueStorageIds) {
    // Bounded, non-paginated read: this helper can run inside handlers that
    // already own the function's single `.paginate()`. The `expiresAt > 0`
    // range excludes terminal claims, so all remaining live claims are
    // consumed rather than hidden behind newer terminal rows.
    const claims = await ctx.db
      .query("sessionMediaClaims")
      .withIndex("by_userId_and_storageId_and_expiresAt", (q) =>
        q.eq("userId", userId).eq("storageId", storageId).gt("expiresAt", 0),
      )
      .take(MAX_SESSION_MEDIA_BATCH);
    for (const claim of claims) {
      if (claim.releasedAt === undefined && claim.consumedAt === undefined) {
        await ctx.db.patch(claim._id, { consumedAt, expiresAt: 0 });
      }
    }
  }
}

export const claim = mutation({
  args: {
    sessionId: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.object({
    claimId: v.id("sessionMediaClaims"),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const now = Date.now();
    const existing = await getSessionClaim(
      ctx,
      user._id,
      args.sessionId,
      args.storageId,
    );
    if (existing) {
      if (existing.releasedAt !== undefined) {
        throw new ConvexError("Media claim was released");
      }
      if (existing.consumedAt !== undefined) {
        throw new ConvexError("Media claim was consumed");
      }
      if (existing.expiresAt <= Date.now()) {
        throw new ConvexError("Media claim has expired");
      }
      return { claimId: existing._id, expiresAt: existing.expiresAt };
    }
    if (!(await hasOwnedPendingAsset(ctx, user._id, args.storageId, now))) {
      throw new ConvexError("Media asset is not eligible for this session");
    }

    const claimId = await ctx.db.insert("sessionMediaClaims", {
      userId: user._id,
      sessionId: args.sessionId,
      storageId: args.storageId,
      createdAt: now,
      renewedAt: now,
      expiresAt: now + SESSION_MEDIA_CLAIM_TTL_MS,
    });
    return { claimId, expiresAt: now + SESSION_MEDIA_CLAIM_TTL_MS };
  },
});

export const renew = mutation({
  args: {
    sessionId: v.string(),
    storageIds: v.array(v.id("_storage")),
    isVisible: v.boolean(),
    isActive: v.boolean(),
  },
  returns: v.object({ renewed: v.number(), expiresAt: v.optional(v.number()) }),
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    assertBatchSize(args.storageIds);
    if (!args.isVisible || !args.isActive) {
      throw new ConvexError("Renewal requires a visible active session");
    }

    const requestedStorageIds = new Set(args.storageIds);
    const now = Date.now();
    let renewed = 0;
    let latestExpiry: number | undefined;
    for (const storageId of requestedStorageIds) {
      const claim = await getSessionClaim(
        ctx,
        user._id,
        args.sessionId,
        storageId,
      );
      if (!claim) continue;
      if (claim.releasedAt !== undefined || claim.consumedAt !== undefined) {
        continue;
      }
      if (claim.expiresAt <= now) continue;
      if (claim.renewedAt + SESSION_MEDIA_RENEW_INTERVAL_MS > now) continue;
      const expiresAt = now + SESSION_MEDIA_CLAIM_TTL_MS;
      await ctx.db.patch(claim._id, { renewedAt: now, expiresAt });
      renewed += 1;
      latestExpiry = Math.max(latestExpiry ?? 0, expiresAt);
    }
    return { renewed, expiresAt: latestExpiry };
  },
});

export const release = mutation({
  args: {
    sessionId: v.string(),
    storageIds: v.array(v.id("_storage")),
  },
  returns: v.object({ released: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    assertBatchSize(args.storageIds);
    const requestedStorageIds = new Set(args.storageIds);
    const releasedAt = Date.now();
    let released = 0;
    for (const storageId of requestedStorageIds) {
      const claim = await getSessionClaim(
        ctx,
        user._id,
        args.sessionId,
        storageId,
      );
      if (
        claim &&
        claim.releasedAt === undefined &&
        claim.consumedAt === undefined
      ) {
        await ctx.db.patch(claim._id, { releasedAt, expiresAt: 0 });
        released += 1;
      }
    }
    return { released };
  },
});

export const cleanupExpired = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const page = await ctx.db
      .query("sessionMediaClaims")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .paginate({ numItems: MAX_SESSION_MEDIA_BATCH, cursor: args.cursor });
    for (const claim of page.page) {
      await ctx.db.delete(claim._id);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.sessionMediaClaims.cleanupExpired,
        {
          cursor: page.continueCursor,
        },
      );
    }
    return null;
  },
});

/**
 * Resolves storage-backed media the caller still owns, so media restored from a
 * local recovery snapshot can render again. Ids the caller does not own, or
 * whose pending asset is gone, resolve to `null` so the client marks them
 * unavailable instead of leaving them stuck "finalizing".
 */
export const getOwnedMediaUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.array(
    v.object({
      storageId: v.id("_storage"),
      url: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    assertBatchSize(args.storageIds);
    const unique = [...new Set(args.storageIds)];
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return unique.map((storageId) => ({ storageId, url: null }));
    const now = Date.now();
    return await Promise.all(
      unique.map(async (storageId) => {
        if (!(await hasOwnedPendingAsset(ctx, user._id, storageId, now))) {
          return { storageId, url: null };
        }
        return { storageId, url: await ctx.storage.getUrl(storageId) };
      }),
    );
  },
});
