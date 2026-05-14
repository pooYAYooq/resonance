/**
 * Convex query and mutation for blog post comments.
 *
 * Data access: reads from and writes to the `comments` table.
 * Auth: `createComment` requires a valid session via `authComponent.safeGetAuthUser`;
 * unauthenticated callers receive a `ConvexError("Unauthorized")`.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

/**
 * Fetches all comments for a given post, ordered newest-first.
 *
 * @param args.postId - `Id<"posts">`: the document ID of the target post.
 * @returns `Promise<Doc<"comments">[]>`: all comments whose `postId` matches.
 */
export const getCommentsByPostId = query({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    // TODO: Replace `.filter()` with `.withIndex()` once an index on
    // `comments.by_postId` is defined in the schema. Using `.filter()`
    // performs a full table scan, which won't scale as the table grows.
    const data = await ctx.db
      .query("comments")
      .filter((q) => q.eq(q.field("postId"), args.postId))
      .order("desc")
      .collect();

    return data;
  },
});

/**
 * Creates a new comment on a post, requiring an authenticated session.
 *
 * Derives `authorId` and `authorName` from the authenticated user — callers
 * must not supply these fields directly. Throws if no valid session is found.
 *
 * @param args.body - `string`: the comment text.
 * @param args.postId - `Id<"posts">`: the document ID of the post to comment on.
 * @returns `Id<"comments">`: the document ID of the newly created comment.
 * @throws `ConvexError("Unauthorized")` if the caller has no valid session.
 */
export const createComment = mutation({
  args: {
    body: v.string(),
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    // Auth gate — derives identity server-side rather than accepting a userId argument.
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Unauthorized");
    }
    return await ctx.db.insert("comments", {
      postId: args.postId,
      body: args.body,
      authorId: user._id,
      authorName: user.name,
    });
  },
});
