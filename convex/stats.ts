/**
 * Site-wide denormalized statistics.
 * A single-row table that avoids loading all posts just to count them.
 */
import { internalMutation, query } from "./_generated/server";

/**
 * Returns the current total post count.
 * Creates a default row (count=0) if none exists yet.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("stats").first();
    if (!stats) {
      return { totalPosts: 0 };
    }
    return { totalPosts: stats.totalPosts };
  },
});

/**
 * Internal mutation: increment the total post count by 1.
 * Called by `createPost` after a successful insert.
 */
export const incrementPostCount = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("stats").first();
    if (!stats) {
      await ctx.db.insert("stats", { totalPosts: 1 });
    } else {
      await ctx.db.patch(stats._id, {
        totalPosts: stats.totalPosts + 1,
      });
    }
  },
});
