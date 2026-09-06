/**
 * Site-wide denormalized statistics.
 * A single-row table that avoids loading all posts just to count them.
 */
import { query, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";

/**
 * Increments the total post count in the stats table within a transaction.
 * Creates a new stats row if none exists yet.
 *
 * @param ctx - The mutation context
 */
export async function incrementPostCountInTransaction(ctx: MutationCtx) {
  const stats = await ctx.db.query("stats").first();
  if (!stats) {
    await ctx.db.insert("stats", { totalPosts: 1 });
  } else {
    if (
      !Number.isSafeInteger(stats.totalPosts) ||
      stats.totalPosts < 0 ||
      stats.totalPosts === Number.MAX_SAFE_INTEGER
    ) {
      throw new ConvexError("Post count is invalid.");
    }
    await ctx.db.patch(stats._id, { totalPosts: stats.totalPosts + 1 });
  }
}

export async function decrementPostCountInTransaction(ctx: MutationCtx) {
  const stats = await ctx.db.query("stats").first();
  if (!stats) return;
  if (!Number.isSafeInteger(stats.totalPosts) || stats.totalPosts <= 0) {
    throw new ConvexError("Post count is invalid.");
  }
  await ctx.db.patch(stats._id, {
    totalPosts: stats.totalPosts - 1,
  });
}

/**
 * Returns the current total post count.
 * Creates a default row (count=0) if none exists yet.
 */
export const getStats = query({
  args: {},
  returns: v.object({ totalPosts: v.number() }),
  handler: async (ctx) => {
    const stats = await ctx.db.query("stats").first();
    if (!stats) {
      return { totalPosts: 0 };
    }
    if (!Number.isSafeInteger(stats.totalPosts) || stats.totalPosts < 0) {
      throw new ConvexError("Post count is invalid.");
    }
    return { totalPosts: stats.totalPosts };
  },
});
