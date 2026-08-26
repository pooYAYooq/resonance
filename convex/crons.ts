import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { FEED_BATCH_SIZE, FEED_WINDOW_MS } from "./feed";

/**
 * Internal mutation that triggers cleanup of expired feed items.
 * Called by the daily feed cleanup cron job.
 */
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
