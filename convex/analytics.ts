import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { requirePublishedPost } from "./postLifecycle";

const UTC_DAY_MS = 24 * 60 * 60 * 1000;

export function getUtcDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export async function requireCurrentUser(
  ctx: Pick<MutationCtx | QueryCtx, "db">,
  userId: string,
): Promise<Doc<"users">> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!user) throw new ConvexError("User not found.");
  return user;
}

export async function incrementAuthorAnalytics(
  ctx: MutationCtx,
  authorId: string,
  counter: "uniqueViews" | "likesReceived",
  delta: number,
) {
  const analytics = await ctx.db
    .query("authorAnalytics")
    .withIndex("by_authorId", (q) => q.eq("authorId", authorId))
    .unique();

  if (!analytics) {
    await ctx.db.insert("authorAnalytics", {
      authorId,
      uniqueViews: counter === "uniqueViews" ? delta : 0,
      likesReceived: counter === "likesReceived" ? delta : 0,
    });
    return;
  }

  await ctx.db.patch(analytics._id, {
    [counter]: analytics[counter] + delta,
  });
}

export async function incrementFollowerGrowthInTransaction(
  ctx: MutationCtx,
  authorId: string,
  timestamp: number,
) {
  const dayStart = getUtcDayStart(timestamp);
  const growthDay = await ctx.db
    .query("followerGrowthDays")
    .withIndex("by_authorId_and_dayStart", (q) =>
      q.eq("authorId", authorId).eq("dayStart", dayStart),
    )
    .unique();

  if (!growthDay) {
    await ctx.db.insert("followerGrowthDays", {
      authorId,
      dayStart,
      gainedCount: 1,
    });
    return;
  }

  await ctx.db.patch(growthDay._id, {
    gainedCount: growthDay.gainedCount + 1,
  });
}

export async function recordUniqueViewInTransaction(
  ctx: MutationCtx,
  post: Doc<"posts">,
  viewerKey: string,
): Promise<boolean> {
  const existingView = await ctx.db
    .query("postViews")
    .withIndex("by_postId_and_viewerKey", (q) =>
      q.eq("postId", post._id).eq("viewerKey", viewerKey),
    )
    .unique();
  if (existingView) return false;

  await ctx.db.insert("postViews", {
    postId: post._id,
    viewerKey,
    createdAt: Date.now(),
  });
  await ctx.db.patch(post._id, {
    uniqueViewCount: post.uniqueViewCount + 1,
  });
  await incrementAuthorAnalytics(ctx, post.authorId, "uniqueViews", 1);
  return true;
}

export const recordView = mutation({
  args: { postId: v.id("posts") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");

    const post = await requirePublishedPost(ctx, args.postId);
    return await recordUniqueViewInTransaction(ctx, post, `user:${user._id}`);
  },
});

export const getSummary = query({
  args: { asOf: v.number() },
  returns: v.union(
    v.object({
      views: v.number(),
      likes: v.number(),
      followerCount: v.number(),
      followerGrowth: v.number(),
      followerGrowthStart: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return null;

    const user = await requireCurrentUser(ctx, authUser._id);

    const analytics = await ctx.db
      .query("authorAnalytics")
      .withIndex("by_authorId", (q) => q.eq("authorId", authUser._id))
      .unique();
    const asOfDayStart = getUtcDayStart(args.asOf);
    const followerGrowthStart = asOfDayStart - 29 * UTC_DAY_MS;
    const growthDays = await ctx.db
      .query("followerGrowthDays")
      .withIndex("by_authorId_and_dayStart", (q) =>
        q
          .eq("authorId", authUser._id)
          .gte("dayStart", followerGrowthStart)
          .lte("dayStart", asOfDayStart),
      )
      .take(30);

    return {
      views: analytics?.uniqueViews ?? 0,
      likes: analytics?.likesReceived ?? 0,
      followerCount: user.followerCount,
      followerGrowth: growthDays.reduce(
        (total, day) => total + day.gainedCount,
        0,
      ),
      followerGrowthStart,
    };
  },
});
