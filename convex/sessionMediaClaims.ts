import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import type { Id } from "./_generated/dataModel";

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
  ctx: MutationCtx,
  userId: string,
  storageId: Id<"_storage">,
): Promise<boolean> {
  const claims = await ctx.db
    .query("pendingUploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .take(MAX_SESSION_MEDIA_BATCH);
  return claims.some((claim) => claim.userId === userId);
}

async function getSessionClaims(
  ctx: MutationCtx,
  userId: string,
  sessionId: string,
) {
  return ctx.db
    .query("sessionMediaClaims")
    .withIndex("by_userId_and_sessionId", (q) =>
      q.eq("userId", userId).eq("sessionId", sessionId),
    )
    .take(MAX_SESSION_MEDIA_BATCH);
}

export async function hasActiveSessionMediaClaim(
  ctx: Pick<MutationCtx, "db">,
  storageId: Id<"_storage">,
  now = Date.now(),
): Promise<boolean> {
  const claims = await ctx.db
    .query("sessionMediaClaims")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .take(MAX_SESSION_MEDIA_BATCH);
  return claims.some(
    (claim) =>
      claim.releasedAt === undefined &&
      claim.consumedAt === undefined &&
      claim.expiresAt > now,
  );
}

export async function consumeSessionMediaClaims(
  ctx: MutationCtx,
  userId: string,
  storageIds: readonly Id<"_storage">[],
  consumedAt = Date.now(),
): Promise<void> {
  const uniqueStorageIds = [...new Set(storageIds)];
  assertBatchSize(uniqueStorageIds);
  for (const storageId of uniqueStorageIds) {
    const claims = await ctx.db
      .query("sessionMediaClaims")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .take(MAX_SESSION_MEDIA_BATCH);
    for (const claim of claims) {
      if (
        claim.userId === userId &&
        claim.releasedAt === undefined &&
        claim.consumedAt === undefined
      ) {
        await ctx.db.patch(claim._id, { consumedAt });
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
    if (!(await hasOwnedPendingAsset(ctx, user._id, args.storageId))) {
      throw new ConvexError("Media asset is not owned by this user");
    }

    const existing = (
      await getSessionClaims(ctx, user._id, args.sessionId)
    ).find((claim) => claim.storageId === args.storageId);
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

    const now = Date.now();
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
    const claims = await getSessionClaims(ctx, user._id, args.sessionId);
    const matchingClaims = claims.filter((claim) =>
      requestedStorageIds.has(claim.storageId),
    );
    let renewed = 0;
    let latestExpiry: number | undefined;
    for (const claim of matchingClaims) {
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
    const claims = await getSessionClaims(ctx, user._id, args.sessionId);
    const releasedAt = Date.now();
    let released = 0;
    for (const claim of claims) {
      if (
        requestedStorageIds.has(claim.storageId) &&
        claim.releasedAt === undefined &&
        claim.consumedAt === undefined
      ) {
        await ctx.db.patch(claim._id, { releasedAt });
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
