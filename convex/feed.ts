import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
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
        q
          .eq("userId", authUser._id)
          .gte("createdAt", args.asOf - FEED_WINDOW_MS)
          .lte("createdAt", args.asOf),
      )
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
      if (!post || post.status !== "published") {
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
        tags: post.tags,
        imageUrl,
        authorName: user?.displayName ?? null,
        authorAvatarUrl: user?.avatarUrl ?? null,
        isLiked: !!like,
      });
    }

    return { ...result, page: hydrated };
  },
});

export const fanOutForPost = internalMutation({
  args: {
    postId: v.id("posts"),
    authorId: v.string(),
    paginationOpts: paginationOptsValidator,
    retryCount: v.number(),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post || post.status !== "published" || post.authorId !== args.authorId) {
      return { done: true, processed: 0 };
    }
    if (post.createdAt < Date.now() - FEED_WINDOW_MS) {
      return { done: true, processed: 0 };
    }

    const result = await ctx.db
      .query("follows")
      .withIndex("by_followingId", (q) => q.eq("followingId", args.authorId))
      .paginate(args.paginationOpts);

    for (const follower of result.page) {
      const currentFollow = await ctx.db.get(follower._id);
      if (!currentFollow) {
        continue;
      }

      const existing = await ctx.db
        .query("feed")
        .withIndex("by_userId_and_postId", (q) =>
          q.eq("userId", currentFollow.followerId).eq("postId", args.postId),
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("feed", {
          userId: currentFollow.followerId,
          postId: args.postId,
          authorId: post.authorId,
          followId: currentFollow._id,
          createdAt: post.publishedAt ?? post.createdAt,
          insertedAt: Date.now(),
        });
      } else if (existing.followId !== currentFollow._id) {
        await ctx.db.patch(existing._id, { followId: currentFollow._id });
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.feed.fanOutForPost, {
        postId: args.postId,
        authorId: args.authorId,
        paginationOpts: {
          numItems: args.paginationOpts.numItems,
          cursor: result.continueCursor,
        },
        retryCount: args.retryCount,
      });
      return { done: false, processed: result.page.length };
    }
    return { done: true, processed: result.page.length };
  },
});

export const backfillForFollow = internalMutation({
  args: {
    userId: v.string(),
    authorId: v.string(),
    followId: v.id("follows"),
    cutoffAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const follow = await ctx.db.get(args.followId);
    if (
      !follow ||
      follow.followerId !== args.userId ||
      follow.followingId !== args.authorId
    ) {
      return { done: true, processed: 0 };
    }

    const result = await ctx.db
      .query("posts")
      .withIndex("by_authorId_and_createdAt", (q) =>
        q.eq("authorId", args.authorId).gte("createdAt", args.cutoffAt),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    for (const post of result.page) {
      if (post.status !== "published") {
        continue;
      }
      const existing = await ctx.db
        .query("feed")
        .withIndex("by_userId_and_postId", (q) =>
          q.eq("userId", args.userId).eq("postId", post._id),
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("feed", {
          userId: args.userId,
          postId: post._id,
          authorId: post.authorId,
          followId: args.followId,
          createdAt: post.createdAt,
          insertedAt: Date.now(),
        });
      } else if (existing.followId !== args.followId) {
        await ctx.db.patch(existing._id, { followId: args.followId });
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.feed.backfillForFollow, {
        ...args,
        paginationOpts: {
          numItems: args.paginationOpts.numItems,
          cursor: result.continueCursor,
        },
      });
      return { done: false, processed: result.page.length };
    }
    return { done: true, processed: result.page.length };
  },
});

export const deleteForUnfollow = internalMutation({
  args: {
    userId: v.string(),
    authorId: v.string(),
    followId: v.id("follows"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("feed")
      .withIndex("by_userId_and_authorId_and_followId_and_createdAt", (q) =>
        q
          .eq("userId", args.userId)
          .eq("authorId", args.authorId)
          .eq("followId", args.followId),
      )
      .paginate(args.paginationOpts);

    for (const row of result.page) {
      await ctx.db.delete(row._id);
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.feed.deleteForUnfollow, {
        ...args,
        paginationOpts: {
          numItems: args.paginationOpts.numItems,
          cursor: result.continueCursor,
        },
      });
      return { done: false, processed: result.page.length };
    }
    return { done: true, processed: result.page.length };
  },
});

export const cleanupExpired = internalMutation({
  args: {
    cutoffAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("feed")
      .order("asc")
      .paginate(args.paginationOpts);

    for (const row of result.page) {
      const currentRow = await ctx.db.get(row._id);
      if (!currentRow) {
        continue;
      }

      const post = await ctx.db.get(currentRow.postId);
      if (currentRow.createdAt < args.cutoffAt || !post) {
        await ctx.db.delete(currentRow._id);
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.feed.cleanupExpired, {
        cutoffAt: args.cutoffAt,
        paginationOpts: {
          numItems: args.paginationOpts.numItems,
          cursor: result.continueCursor,
        },
      });
      return { done: false, processed: result.page.length };
    }
    return { done: true, processed: result.page.length };
  },
});
