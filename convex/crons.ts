import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { FEED_BATCH_SIZE, FEED_WINDOW_MS } from "./feed";

const POST_LIFECYCLE_BACKFILL_BATCH_SIZE = 100;

/** Starts one bounded legacy-post normalization chain for an operator. */
export const runPostLifecycleBackfill = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.postLifecycle.backfillPublishedPosts,
      {
        paginationOpts: {
          numItems: POST_LIFECYCLE_BACKFILL_BATCH_SIZE,
          cursor: null,
        },
      },
    );
    return null;
  },
});

export const runFeedCleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.feed.cleanupExpired, {
      cutoffAt: Date.now() - FEED_WINDOW_MS,
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
    });
  },
});

const crons = cronJobs();

crons.interval(
  "daily feed cleanup",
  { hours: 24 },
  internal.crons.runFeedCleanup,
  {},
);

crons.interval(
  "pending inline upload cleanup",
  { minutes: 15 },
  internal.pendingUploads.cleanupExpired,
  { cursor: null },
);

export default crons;
