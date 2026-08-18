/**
 * Convex queries and mutations for the notifications fan-out, list, and
 * mark-all-read flow.
 *
 * Data access: writes to `notifications` and `users` (denormalized
 * `unreadNotificationCount`); reads from `follows` (via the
 * `by_followingId` index), `notifications` (via
 * `by_recipientId_and_createdAt`), `users` (for actor + recipient
 * hydration), and `posts` (for the post title).
 *
 * Auth: `markAllRead` requires a valid session via
 * `authComponent.safeGetAuthUser`; unauthenticated callers receive a
 * `ConvexError("Unauthorized")`. `getUnreadCount` and
 * `getNotifications` fail-soft (return 0 / empty page) for
 * unauthenticated callers so the bell and `/notifications` route can
 * mount safely in anonymous contexts. `fanOutForPost` is internal and
 * trusts its caller (the only caller is the auth-gated `publishPost`).
 */
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

export const FANOUT_BATCH_SIZE = 200;

/**
 * Fans out a single published post to the author's followers by
 * inserting one `notifications` row per follower and bumping each
 * recipient's denormalized `users.unreadNotificationCount`.
 *
 * Reads followers in `paginate` batches via the `follows.by_followingId`
 * index, ordered `(followingId, createdAt)`. Convex's built-in
 * `paginate` cursor handles tie-breaking correctly — a manual
 * `lastCreatedAt` cursor would skip followers that share the same
 * `createdAt` (very plausible for batched sign-ups). The first call
 * from `publishPost` passes `cursor: null`; scheduler continuations
 * pass the previous batch's `continueCursor`.
 *
 * If the batch is full (`!isDone`), the function self-schedules a
 * continuation with the returned `continueCursor`, returning
 * immediately. `publishPost` therefore returns the post ID after the
 * first batch is queued (or after the fan-out completes if the author
 * has < 200 followers).
 *
 * Trust model: invoked only by `publishPost` via
 * `ctx.runMutation(internal.notifications.fanOutForPost, ...)`. The
 * only caller is the auth-gated `publishPost`, so this function does
 * NOT call `safeGetAuthUser` — mirroring the
 * `internal.stats.incrementPostCount` precedent.
 *
 * Failure mode: if the mutation throws (transaction limit, OCC), the
 * post is already published and `publishPost` already returned the
 * post ID. Convex discards ALL writes from the top-level mutation
 * when it throws, including notifications processed earlier in the
 * loop. Acceptable for the Medium-High slice: the post is the source
 * of truth, the notification is a hint.
 *
 * @param args.postId - `Id<"posts">`: the freshly published post.
 * @param args.authorId - Better Auth user ID (string) of the
 *   publishing author. Not a Convex `users._id`.
 * @param args.paginationOpts - `PaginationOptions`: the first call
 *   from `publishPost` passes `{ numItems: FANOUT_BATCH_SIZE, cursor:
 *   null }`; scheduler continuations pass the previous batch's
 *   `continueCursor` with the same `numItems`.
 * @returns `{ done: boolean, processed: number }`: `done` is `true`
 *   on the final batch; `processed` is the count of followers handled
 *   in this batch.
 */
export const fanOutForPost = internalMutation({
  args: {
    postId: v.id("posts"),
    authorId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("follows")
      .withIndex("by_followingId", (q) => q.eq("followingId", args.authorId))
      .paginate(args.paginationOpts);

    for (const follower of result.page) {
      await ctx.db.insert("notifications", {
        recipientId: follower.followerId,
        actorId: args.authorId,
        postId: args.postId,
        createdAt: Date.now(),
      });

      const recipient = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", follower.followerId))
        .unique();
      if (recipient) {
        await ctx.db.patch(recipient._id, {
          unreadNotificationCount: (recipient.unreadNotificationCount ?? 0) + 1,
        });
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.notifications.fanOutForPost, {
        postId: args.postId,
        authorId: args.authorId,
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

/**
 * Returns the caller's denormalized unread notification count for the
 * Navbar bell badge. A single O(1) doc read via the `users.by_userId`
 * index — deliberately a separate query from `getUserProfile` (which
 * runs an unbounded `.collect()` for `postCount`) so the bell
 * subscription does not amplify that read on every render. Mirrors
 * `follows.getFollowCounts` (the 1.4 `ProfileStats` precedent).
 *
 * Unauthenticated callers receive `0` (no identity to read a counter
 * for). The bell is auth-gated and does not render for anonymous
 * visitors, but the fail-soft default keeps the query safe in any
 * mount context.
 *
 * @returns `number` — the caller's `unreadNotificationCount`, falling
 *   back to 0 for missing rows or pre-Phase-1.6 user docs without
 *   the field.
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return 0;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
      .unique();
    return user?.unreadNotificationCount ?? 0;
  },
});

type HydratedNotification = Doc<"notifications"> & {
  actorName: string | null;
  actorAvatarUrl: string | null;
  postTitle: string | null;
};

/**
 * Returns the caller's notifications, newest first, paginated. Each
 * row is hydrated with the actor's display name + avatar and the
 * post's title. A page may span multiple actors (a reader's
 * notifications from different followed authors), so actor lookups
 * are deduplicated per page and issued via `Promise.all` over unique
 * actor IDs — adapted from Phase 1.1 rule #2 (hoist shared lookups
 * out of paginated maps) for the case where the shared value varies
 * per row.
 *
 * Notifications whose `postId` points to a deleted post return
 * `postTitle: null`; the consuming client (`NotificationsList`)
 * filters those rows before rendering.
 *
 * Unauthenticated callers receive an empty, done page (fail-soft
 * guard; the `/notifications` page redirects unauthenticated visitors
 * before they reach this query).
 *
 * @param args.paginationOpts - `PaginationOptions`: Convex pagination
 *   config (typically `{ numItems, cursor }`).
 * @returns `PaginationResult<HydratedNotification>`: a page of
 *   hydrated notifications, newest first.
 */
export const getNotifications = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const result = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_createdAt", (q) =>
        q.eq("recipientId", authUser._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const uniqueActorIds = Array.from(
      new Set(result.page.map((n) => n.actorId)),
    );

    const actorDocs = await Promise.all(
      uniqueActorIds.map(
        async (id): Promise<[string, Doc<"users"> | null]> => [
          id,
          await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", id))
            .unique(),
        ],
      ),
    );
    const actorById = new Map<string, Doc<"users"> | null>(actorDocs);

    const hydrated: HydratedNotification[] = await Promise.all(
      result.page.map(async (notification) => {
        const actor = actorById.get(notification.actorId) ?? null;
        const post = await ctx.db.get(notification.postId);
        return {
          ...notification,
          actorName: actor?.displayName ?? null,
          actorAvatarUrl: actor?.avatarUrl ?? null,
          postTitle: post?.title ?? null,
        };
      }),
    );

    return { ...result, page: hydrated };
  },
});

/**
 * Resets the caller's denormalized `users.unreadNotificationCount` to
 * 0 in a single `ctx.db.patch`. The rows in the `notifications` table
 * are NOT deleted — they remain as visual history for the paginated
 * list. The bell badge drops to 0 reactively via the
 * `getUnreadCount` subscription.
 *
 * This is a single counter reset, not a row delete. Deleting the
 * visible page on mount would re-render the list empty before the
 * user sees it; resetting the counter instead lets the page render
 * the existing rows while the badge clears.
 *
 * @returns `{ ok: true }` on success.
 * @throws `ConvexError("Unauthorized")` if the caller has no session.
 * @throws `ConvexError("User not found.")` if the caller's app-level
 *   `users` doc does not exist (AuthSync race guard, same as
 *   `toggleFollow`).
 */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx): Promise<{ ok: true }> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      throw new ConvexError("Unauthorized");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
      .unique();
    if (!user) {
      throw new ConvexError("User not found.");
    }
    await ctx.db.patch(user._id, { unreadNotificationCount: 0 });
    return { ok: true };
  },
});
