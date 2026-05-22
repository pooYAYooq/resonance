/**
 * One-off backfill mutations for schema changes.
 * These are run manually (e.g., via the Convex dashboard or CLI) and should
 * be removed once every environment has been migrated.
 */

import { mutation } from "./_generated/server";

/**
 * Backfills missing `commentCount` values on existing posts.
 * Sets `commentCount: 0` for any post where the field is absent.
 *
 * Run once per environment via the Convex dashboard or `npx convex dev`.
 */
export const backfillPostCommentCounts = mutation({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").collect();
    let patched = 0;

    for (const post of posts) {
      if (post.commentCount === undefined) {
        await ctx.db.patch(post._id, { commentCount: 0 });
        patched++;
      }
    }

    return { patched };
  },
});
