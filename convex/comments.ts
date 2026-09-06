/**
 * Convex query and mutation for blog post comments.
 *
 * Data access: reads from and writes to the `comments` table.
 * Auth: `createComment` requires a valid session via `authComponent.safeGetAuthUser`;
 * unauthenticated callers receive a `ConvexError("Unauthorized")`.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { authComponent } from "./auth";
import { updateDiscoverPostEngagement } from "./discoverProjection";
import { getPublishedPost, requirePublishedPost } from "./postLifecycle";

function validatePaginationOptions(options: {
  numItems: number;
  maximumRowsRead?: number;
}) {
  if (
    !Number.isSafeInteger(options.numItems) ||
    options.numItems < 1 ||
    options.numItems > 20
  ) {
    throw new ConvexError("Page size must be a safe integer between 1 and 20.");
  }
  if (
    options.maximumRowsRead !== undefined &&
    (!Number.isSafeInteger(options.maximumRowsRead) ||
      options.maximumRowsRead < 1 ||
      options.maximumRowsRead > 20)
  ) {
    throw new ConvexError(
      "Pagination rows must be a safe integer between 1 and 20.",
    );
  }
}

const commentResultValidator = v.object({
  _id: v.id("comments"),
  _creationTime: v.number(),
  postId: v.id("posts"),
  authorId: v.string(),
  authorName: v.string(),
  body: v.string(),
  likeCount: v.number(),
  createdAt: v.number(),
  authorAvatarUrl: v.union(v.string(), v.null()),
  isLiked: v.boolean(),
});

function validateCommentCountForIncrement(commentCount: number) {
  if (!Number.isSafeInteger(commentCount) || commentCount < 0) {
    throw new ConvexError("Comment count is corrupted.");
  }
  if (commentCount === Number.MAX_SAFE_INTEGER) {
    throw new ConvexError(
      "Comment count cannot exceed Number.MAX_SAFE_INTEGER.",
    );
  }
}

/**
 * Fetches paginated comments for a given post, ordered newest-first.
 *
 * @param args.postId - `Id<"posts">`: the document ID of the target post.
 * @param args.paginationOpts - `PaginationOptions`: Convex pagination config.
 * @returns `PaginationResult`: paginated result where `page` contains comments with
 *   `authorAvatarUrl` (`string | null`), `likeCount` (`number`), `isLiked` (`boolean`, always `false` for unauthenticated
 *   callers), plus `isDone` and `continueCursor`.
 */
export const getCommentsByPostId = query({
  args: {
    postId: v.id("posts"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(commentResultValidator),
  handler: async (ctx, args) => {
    validatePaginationOptions(args.paginationOpts);

    if (!(await getPublishedPost(ctx, args.postId))) {
      return {
        page: [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
      };
    }

    const result = await ctx.db
      .query("comments")
      .withIndex("by_postId_and_createdAt", (q) => q.eq("postId", args.postId))
      .order("desc")
      .paginate(args.paginationOpts);

    const authUser = await authComponent.safeGetAuthUser(ctx);

    const page = await Promise.all(
      result.page.map(async (comment) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", comment.authorId))
          .unique();

        let isLiked = false;
        if (authUser) {
          const like = await ctx.db
            .query("commentLikes")
            .withIndex("by_commentId_and_userId", (q) =>
              q.eq("commentId", comment._id).eq("userId", authUser._id),
            )
            .unique();
          isLiked = !!like;
        }

        return {
          ...comment,
          likeCount: comment.likeCount,
          authorAvatarUrl: user?.avatarUrl ?? null,
          isLiked,
        };
      }),
    );

    return { ...result, page };
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
  returns: v.id("comments"),
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

    const post = await requirePublishedPost(ctx, args.postId);
    validateCommentCountForIncrement(post.commentCount);

    const commentId = await ctx.db.insert("comments", {
      postId: args.postId,
      body,
      authorId: user._id,
      authorName: user.name?.trim() || "Anonymous",
      likeCount: 0,
      createdAt: Date.now(),
    });

    const nextCount = post.commentCount + 1;
    await ctx.db.patch(args.postId, {
      commentCount: nextCount,
    });
    await updateDiscoverPostEngagement(ctx, args.postId, {
      commentCount: nextCount,
    });

    return commentId;
  },
});
