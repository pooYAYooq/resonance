import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { FEED_BATCH_SIZE, FEED_WINDOW_MS } from "./feed";

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

export default crons;
