import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export type PostSummary = {
  _id: Id<"posts">;
  title: string;
  body: string;
  tags: string[];
  authorId: string;
  createdAt: number;
  commentCount: number;
  likeCount: number;
  imageUrl: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  isLiked: boolean;
  isBookmarked: boolean;
};

export const postSummaryValidator = v.object({
  _id: v.id("posts"),
  title: v.string(),
  body: v.string(),
  tags: v.array(v.string()),
  authorId: v.string(),
  createdAt: v.number(),
  commentCount: v.number(),
  likeCount: v.number(),
  imageUrl: v.union(v.string(), v.null()),
  authorName: v.union(v.string(), v.null()),
  authorAvatarUrl: v.union(v.string(), v.null()),
  isLiked: v.boolean(),
  isBookmarked: v.boolean(),
});

export async function hydratePostSummary(
  ctx: QueryCtx,
  post: Doc<"posts">,
  viewerId: string | null,
): Promise<PostSummary> {
  const imageUrl = post.imageStorageId
    ? await ctx.storage.getUrl(post.imageStorageId)
    : null;
  const author = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", post.authorId))
    .unique();

  let isLiked = false;
  let isBookmarked = false;
  if (viewerId) {
    const like = await ctx.db
      .query("likes")
      .withIndex("by_postId_and_userId", (q) =>
        q.eq("postId", post._id).eq("userId", viewerId),
      )
      .unique();
    const bookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_and_postId", (q) =>
        q.eq("userId", viewerId).eq("postId", post._id),
      )
      .unique();
    isLiked = !!like;
    isBookmarked = !!bookmark;
  }

  return {
    _id: post._id,
    title: post.title,
    body: post.body,
    tags: post.tags,
    authorId: post.authorId,
    createdAt: post.createdAt,
    commentCount: post.commentCount,
    likeCount: post.likeCount,
    imageUrl,
    authorName: author?.displayName ?? null,
    authorAvatarUrl: author?.avatarUrl ?? null,
    isLiked,
    isBookmarked,
  };
}
