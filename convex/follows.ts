/**
 * Convex mutations and queries for the follower/following graph.
 *
 * Data access: reads from and writes to the `follows` table, and
 * patches denormalized `followerCount` / `followingCount` on the
 * `users` table. Auth: `toggleFollow` requires a valid session via
 * `authComponent.safeGetAuthUser`; unauthenticated callers receive a
 * `ConvexError("Unauthorized")`.
 *
 * Faithful mirror of `convex/likes.ts`: idempotent toggle, single
 * `.unique()` probe, denormalized counters patched in the same
 * transaction. Identity is derived server-side — `followerId` is
 * never accepted as a function argument.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { internal } from "./_generated/api";
import { FEED_BATCH_SIZE, FEED_WINDOW_MS } from "./feed";

/**
 * Toggles a follow relationship between the currently authenticated
 * user (follower) and the target author (following).
 *
 * If the caller already follows the target, the follow row is
 * deleted and both denormalized counts are decremented. Otherwise a
 * new follow row is inserted and both counts are incremented.
 *
 * Self-follow and follows toward a missing user are hard errors to
 * prevent denormalized-count drift.
 *
 * @param args.followingId - Better Auth user ID (string) of the
 *   author to follow/unfollow. Not a Convex `users._id`.
 * @returns `{ following: boolean }` — whether the caller is now
 *   following the target. The count bump is delivered to UI via the
 *   reactive `getFollowCounts` subscription, not via this return.
 * @throws `ConvexError("Unauthorized")` if the caller has no session.
 * @throws `ConvexError("You can't follow yourself.")` on self-follow.
 * @throws `ConvexError("User not found.")` if the target or the
 *   caller's app-level `users` doc does not exist.
 */
export const toggleFollow = mutation({
  args: {
    followingId: v.string(),
  },
  handler: async (ctx, args) => {
    // Auth gate — derives identity server-side, never from an arg.
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      throw new ConvexError("Unauthorized");
    }

    // Self-follow guard prevents denormalized-count drift and a
    // meaningless self-relationship row.
    if (authUser._id === args.followingId) {
      throw new ConvexError("You can't follow yourself.");
    }

    // Target user — the author being followed.
    const target = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.followingId))
      .unique();
    if (!target) {
      throw new ConvexError("User not found.");
    }

    // Current user — needed to patch their `followingCount`. The
    // AuthSync fire-and-forget `syncUser` contract guarantees this
    // row exists for any authenticated caller; a missing row means
    // sync raced and we surface it as a hard error rather than
    // silently writing a dangling follow.
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
      .unique();
    if (!currentUser) {
      throw new ConvexError("User not found.");
    }

    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_followerId_and_followingId", (q) =>
        q.eq("followerId", authUser._id).eq("followingId", args.followingId),
      )
      .unique();

    if (existingFollow) {
      await ctx.db.delete(existingFollow._id);
      await ctx.db.patch(currentUser._id, {
        followingCount: currentUser.followingCount - 1,
      });
      await ctx.db.patch(target._id, {
        followerCount: target.followerCount - 1,
      });
      await ctx.scheduler.runAfter(0, internal.feed.deleteForUnfollow, {
        userId: authUser._id,
        authorId: args.followingId,
        followId: existingFollow._id,
        paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
      });
      return { following: false };
    }

    const followId = await ctx.db.insert("follows", {
      followerId: authUser._id,
      followingId: args.followingId,
      createdAt: Date.now(),
    });
    await ctx.db.patch(currentUser._id, {
      followingCount: currentUser.followingCount + 1,
    });
    await ctx.db.patch(target._id, {
      followerCount: target.followerCount + 1,
    });
    await ctx.scheduler.runAfter(0, internal.feed.backfillForFollow, {
      userId: authUser._id,
      authorId: args.followingId,
      followId,
      cutoffAt: Date.now() - FEED_WINDOW_MS,
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
    });
    return { following: true };
  },
});

/**
 * Reports whether the currently authenticated user follows the given
 * author. Returns `false` when the caller is unauthenticated (no
 * identity to probe), so the follow button can mount safely in
 * anonymous contexts and simply render its "Follow" label without
 * first checking auth on the client.
 *
 * @param args.followingId - Better Auth user ID (string) of the author.
 * @returns `boolean` — `true` if the caller is authenticated and
 *   follows the target, `false` otherwise.
 */
export const isFollowing = query({
  args: {
    followingId: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return false;
    }

    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_followerId_and_followingId", (q) =>
        q.eq("followerId", authUser._id).eq("followingId", args.followingId),
      )
      .unique();

    return !!existingFollow;
  },
});

/**
 * Returns the denormalized `followerCount` and `followingCount` for a
 * user. A single-doc O(1) read via the `users.by_userId` index —
 * deliberately a separate query from `getUserProfile`, which runs an
 * unbounded `.collect()` for `postCount` that we do not want to
 * amplify just to display two integers on the profile header.
 *
 * `ProfileStats` subscribes to this query so the displayed counts
 * bump live the moment `toggleFollow` patches the `users` doc; the
 * mutation return is not used for the count update.
 *
 * @param args.userId - Better Auth user ID (string) of the profile owner.
 * @returns `{ followerCount: number, followingCount: number }` —
 *   always returns numbers, falling back to `0` for missing rows or
 *   user docs without the counters (pre-Phase-1.4 docs).
 */
export const getFollowCounts = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    followerCount: number;
    followingCount: number;
  }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return {
      followerCount: user?.followerCount ?? 0,
      followingCount: user?.followingCount ?? 0,
    };
  },
});
