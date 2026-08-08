import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { authComponent } from "./auth";

export const FEED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const FEED_PAGE_SIZE = 20;
export const FEED_BATCH_SIZE = 100;

export const getFeed = query({
  args: {
    asOf: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (
      args.paginationOpts.numItems !== FEED_PAGE_SIZE ||
      args.paginationOpts.maximumRowsRead !== FEED_PAGE_SIZE
    ) {
      throw new ConvexError("Feed pages must request exactly 20 rows");
    }

    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const result = await ctx.db
      .query("feed")
      .withIndex("by_userId_and_createdAt_and_insertedAt_and_postId", (q) =>
        q.eq("userId", authUser._id).gte(
          "createdAt",
          args.asOf - FEED_WINDOW_MS,
        ),
      )
      .filter((q) => q.lte(q.field("createdAt"), args.asOf))
      .order("desc")
      .paginate(args.paginationOpts);

    const seenPostIds = new Set<string>();
    const hydrated = [];
    for (const row of result.page) {
      if (seenPostIds.has(row.postId)) {
        continue;
      }
      seenPostIds.add(row.postId);

      const post = await ctx.db.get(row.postId);
      if (!post) {
        continue;
      }

      const imageUrl = post.imageStorageId
        ? await ctx.storage.getUrl(post.imageStorageId)
        : null;
      const user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", post.authorId))
        .unique();
      const like = await ctx.db
        .query("likes")
        .withIndex("by_postId_and_userId", (q) =>
          q.eq("postId", post._id).eq("userId", authUser._id),
        )
        .unique();

      hydrated.push({
        ...post,
        imageUrl,
        authorName: user?.displayName ?? null,
        authorAvatarUrl: user?.avatarUrl ?? null,
        isLiked: !!like,
      });
    }

    return { ...result, page: hydrated };
  },
});
