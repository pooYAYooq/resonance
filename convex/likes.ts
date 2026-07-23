/**
 * Convex query and mutation for blog post likes.
 *
 * Data access: reads from and writes to the `likes` table.
 * Auth: `toggleLike` requires a valid session via `authComponent.safeGetAuthUser`;
 * unauthenticated callers receive a `ConvexError("Unauthorized")`.
 */
import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { authComponent } from "./auth";

/**
 * Toggles a like on a post for the currently authenticated user.
 *
 * If the user has already liked the post, the like is removed and the post's
 * `likeCount` is decremented. If not, a new like is created and `likeCount` is
 * incremented.
 *
 * @param args.postId - `Id<"posts">`: the document ID of the target post.
 * @returns `{ liked: boolean, likeCount: number }`: whether the post is now
 *   liked by the caller and the current like count.
 * @throws `ConvexError("Unauthorized")` if the caller has no valid session.
 * @throws `ConvexError("Post not found.")` if the post does not exist.
 */
export const toggleLike = mutation({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    // Auth gate — derives identity server-side rather than accepting a userId argument.
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Unauthorized");
    }

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new ConvexError("Post not found.");
    }

    const existingLike = await ctx.db
      .query("likes")
      .withIndex("by_postId_and_userId", (q) =>
        q.eq("postId", args.postId).eq("userId", user._id),
      )
      .unique();

    if (existingLike) {
      await ctx.db.delete(existingLike._id);
      const nextCount = (post.likeCount ?? 0) - 1;
      await ctx.db.patch(args.postId, {
        likeCount: nextCount,
      });
      return { liked: false, likeCount: nextCount };
    }

    await ctx.db.insert("likes", {
      postId: args.postId,
      userId: user._id,
      createdAt: Date.now(),
    });
    const nextCount = (post.likeCount ?? 0) + 1;
    await ctx.db.patch(args.postId, {
      likeCount: nextCount,
    });
    return { liked: true, likeCount: nextCount };
  },
});

/**
 * Toggles a like on a comment for the currently authenticated user.
 *
 * Mirrors `toggleLike` for posts: one like per user per comment, with a
 * denormalized `comment.likeCount` kept in sync in the same transaction.
 *
 * @param args.commentId - `Id<"comments">`: the document ID of the target comment.
 * @returns `{ liked: boolean, likeCount: number }`: whether the comment is now
 *   liked by the caller and the current like count.
 * @throws `ConvexError("Unauthorized")` if the caller has no valid session.
 * @throws `ConvexError("Comment not found.")` if the comment does not exist.
 */
export const toggleCommentLike = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Unauthorized");
    }

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError("Comment not found.");
    }

    const existingLike = await ctx.db
      .query("commentLikes")
      .withIndex("by_commentId_and_userId", (q) =>
        q.eq("commentId", args.commentId).eq("userId", user._id),
      )
      .unique();

    if (existingLike) {
      await ctx.db.delete(existingLike._id);
      const nextCount = (comment.likeCount ?? 0) - 1;
      await ctx.db.patch(args.commentId, {
        likeCount: nextCount,
      });
      return { liked: false, likeCount: nextCount };
    }

    await ctx.db.insert("commentLikes", {
      commentId: args.commentId,
      userId: user._id,
      createdAt: Date.now(),
    });
    const nextCount = (comment.likeCount ?? 0) + 1;
    await ctx.db.patch(args.commentId, {
      likeCount: nextCount,
    });
    return { liked: true, likeCount: nextCount };
  },
});
