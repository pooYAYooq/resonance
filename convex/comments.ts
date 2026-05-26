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
    const data = await ctx.db
      .query("comments")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .order("desc")
      .take(500);

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

    const body = args.body.trim();
    if (body.length < 3 || body.length > 1000) {
      throw new ConvexError("Comment must be between 3 and 1000 characters.");
    }

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new ConvexError("Post not found.");
    }

    const commentId = await ctx.db.insert("comments", {
      postId: args.postId,
      body,
      authorId: user._id,
      authorName: user.name?.trim() || "Anonymous",
    });

    const nextCount = (post.commentCount ?? 0) + 1;
    await ctx.db.patch(args.postId, {
      commentCount: nextCount,
    });

    return commentId;
  },
});
