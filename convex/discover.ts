import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { isCanonicalPostTag, POST_TAGS } from "../lib/constants/post-tags";

const discoverSummaryValidator = v.object({
  _id: v.id("posts"),
  title: v.string(),
  bodyText: v.string(),
  authorId: v.string(),
  authorName: v.string(),
  tags: v.array(v.string()),
  imageUrl: v.union(v.string(), v.null()),
  publishedAt: v.number(),
  commentCount: v.number(),
  likeCount: v.number(),
});

const MAX_DISCOVER_PAGE_SIZE = 20;

function assertDiscoverPageSize(options: {
  numItems: number;
  maximumRowsRead?: number;
}): void {
  if (
    !Number.isSafeInteger(options.numItems) ||
    options.numItems < 1 ||
    options.numItems > MAX_DISCOVER_PAGE_SIZE
  ) {
    throw new ConvexError(
      "Discover page size must be a safe integer from 1 to 20.",
    );
  }
  if (
    options.maximumRowsRead !== undefined &&
    (!Number.isSafeInteger(options.maximumRowsRead) ||
      options.maximumRowsRead < 1 ||
      options.maximumRowsRead > MAX_DISCOVER_PAGE_SIZE)
  ) {
    throw new ConvexError(
      "Discover pagination rows must be a safe integer from 1 to 20.",
    );
  }
}

type DiscoverSummary = {
  _id: Doc<"posts">["_id"];
  title: string;
  bodyText: string;
  authorId: string;
  authorName: string;
  tags: string[];
  imageUrl: string | null;
  publishedAt: number;
  commentCount: number;
  likeCount: number;
};

// Hydrate only the returned projection page to keep related reads bounded.
async function hydrateDiscoverPosts(
  ctx: QueryCtx,
  rows: readonly Doc<"discoverPosts">[],
): Promise<DiscoverSummary[]> {
  return await Promise.all(
    rows.map(
      async (row): Promise<DiscoverSummary> => ({
        _id: row.postId,
        title: row.title,
        bodyText: row.bodyText,
        authorId: row.authorId,
        authorName: row.authorName,
        tags: row.tags,
        imageUrl: row.imageStorageId
          ? await ctx.storage.getUrl(row.imageStorageId)
          : null,
        publishedAt: row.publishedAt,
        commentCount: row.commentCount,
        likeCount: row.likeCount,
      }),
    ),
  );
}

async function hydrateSearchPosts(
  ctx: QueryCtx,
  rows: readonly Doc<"discoverPostSearch">[],
): Promise<DiscoverSummary[]> {
  const summaries = await Promise.all(
    rows.map(async (row) => {
      return await ctx.db
        .query("discoverPosts")
        .withIndex("by_postId", (q) => q.eq("postId", row.postId))
        .unique();
    }),
  );
  return await hydrateDiscoverPosts(
    ctx,
    summaries.filter(
      (summary): summary is Doc<"discoverPosts"> => summary !== null,
    ),
  );
}

export const getDiscoverPosts = query({
  args: {
    mode: v.union(v.literal("latest"), v.literal("search")),
    query: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(discoverSummaryValidator),
  handler: async (ctx, args) => {
    assertDiscoverPageSize(args.paginationOpts);

    if (args.mode === "search") {
      const searchQuery = args.query?.trim();
      if (!searchQuery) {
        return { page: [], isDone: true, continueCursor: "" };
      }

      const result = await ctx.db
        .query("discoverPostSearch")
        .withSearchIndex("search_searchableText", (q) =>
          q.search("searchableText", searchQuery),
        )
        .paginate(args.paginationOpts);
      return {
        ...result,
        page: await hydrateSearchPosts(ctx, result.page),
      };
    }

    const result = await ctx.db
      .query("discoverPosts")
      .withIndex("by_publishedAt")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await hydrateDiscoverPosts(ctx, result.page),
    };
  },
});

export const getTopics = query({
  args: {},
  returns: v.array(
    v.object({
      tag: v.string(),
      publishedCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const topics = [];
    for (const tag of POST_TAGS) {
      const stat = await ctx.db
        .query("topicStats")
        .withIndex("by_tag", (q) => q.eq("tag", tag))
        .unique();
      if (
        stat &&
        Number.isSafeInteger(stat.publishedCount) &&
        stat.publishedCount >= 0 &&
        stat.publishedCount > 0
      ) {
        topics.push({ tag, publishedCount: stat.publishedCount });
      }
    }
    return topics;
  },
});

export const getTopicPosts = query({
  args: {
    tag: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(discoverSummaryValidator),
  handler: async (ctx, args) => {
    assertDiscoverPageSize(args.paginationOpts);

    if (!isCanonicalPostTag(args.tag)) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const result = await ctx.db
      .query("discoverPostTopics")
      .withIndex("by_tag_and_publishedAt", (q) => q.eq("tag", args.tag))
      .order("desc")
      .paginate(args.paginationOpts);
    const rows: Doc<"discoverPosts">[] = [];
    for (const topic of result.page) {
      const post = await ctx.db
        .query("discoverPosts")
        .withIndex("by_postId", (q) => q.eq("postId", topic.postId))
        .unique();
      if (post) rows.push(post);
    }
    return {
      ...result,
      page: await hydrateDiscoverPosts(ctx, rows),
    };
  },
});
