import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  buildSearchableText,
  ensureCanonicalTopicStats,
  syncPublishedPostProjection,
} from "./discoverProjection";

export const DISCOVER_BATCH_SIZE = 50;

const maintenanceResult = v.object({
  processed: v.number(),
  isDone: v.boolean(),
});

function validateBatchSize(numItems: number): void {
  if (
    !Number.isSafeInteger(numItems) ||
    numItems < 1 ||
    numItems > DISCOVER_BATCH_SIZE
  ) {
    throw new ConvexError(
      `Discover maintenance pages must request 1-${DISCOVER_BATCH_SIZE} rows`,
    );
  }
}

export const backfillDiscover = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: maintenanceResult,
  handler: async (ctx, args) => {
    validateBatchSize(args.paginationOpts.numItems);
    await ensureCanonicalTopicStats(ctx);

    // Backfill is retry-safe and idempotent while continuing in bounded transactions.
    const result = await ctx.db
      .query("posts")
      .withIndex("by_status_and_publishedAt", (q) =>
        q.eq("status", "published"),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: DISCOVER_BATCH_SIZE,
      });

    for (const post of result.page) {
      await syncPublishedPostProjection(ctx, post._id);
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.discoverBackfill.backfillDiscover,
        {
          paginationOpts: {
            ...args.paginationOpts,
            cursor: result.continueCursor,
          },
        },
      );
    }

    return { processed: result.page.length, isDone: result.isDone };
  },
});

export const repairAuthorName = internalMutation({
  args: {
    authorId: v.string(),
    paginationOpts: paginationOptsValidator,
    newAuthorName: v.string(),
  },
  returns: maintenanceResult,
  handler: async (ctx, args) => {
    validateBatchSize(args.paginationOpts.numItems);

    const author = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.authorId))
      .unique();
    const authorName =
      author && author.displayName !== args.newAuthorName
        ? author.displayName
        : args.newAuthorName;

    // Repair author denormalization in bounded pages while preserving source posts.
    const result = await ctx.db
      .query("discoverPosts")
      .withIndex("by_authorId", (q) => q.eq("authorId", args.authorId))
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: DISCOVER_BATCH_SIZE,
      });

    for (const post of result.page) {
      await ctx.db.patch(post._id, {
        authorName,
        searchableText: buildSearchableText(
          post.title,
          post.bodyText,
          authorName,
        ),
      });
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.discoverBackfill.repairAuthorName,
        {
          ...args,
          paginationOpts: {
            ...args.paginationOpts,
            cursor: result.continueCursor,
          },
        },
      );
    }

    return { processed: result.page.length, isDone: result.isDone };
  },
});
