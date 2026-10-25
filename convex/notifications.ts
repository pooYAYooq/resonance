/**
 * Convex queries and mutations for the notifications list, per-row
 * read, and mark-all-read flow.
 *
 * Data access: writes to `notifications` and `users` (denormalized
 * `unreadNotificationCount`); reads from `notifications` (via
 * `by_recipientId_and_createdAt`), `users` (for actor + recipient
 * hydration), and `posts` (for the post title).
 *
 * Auth: `markAllRead` requires a valid session via
 * `authComponent.safeGetAuthUser`; unauthenticated callers receive a
 * `ConvexError("Unauthorized")`. `getUnreadCount` and
 * `getNotifications` fail-soft (return 0 / empty page) for
 * unauthenticated callers so the bell and `/notifications` route can
 * mount safely in anonymous contexts.
 */
import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import {
  paginationOptsValidator,
  paginationResultValidator,
  type PaginationOptions,
} from "convex/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { commentExcerpt } from "./notificationEvents";

const READ_BATCH_SIZE = 100;
const COUNT_CAP = 1000;
const DISMISS_BATCH_SIZE = 100;

export type DismissScope = "all" | "read" | "unread";

const dismissScopeValidator = v.union(
  v.literal("all"),
  v.literal("read"),
  v.literal("unread"),
);

function matchesDismissScope(
  row: Doc<"notifications">,
  scope: DismissScope,
): boolean {
  if (scope === "all") {
    return true;
  }
  return scope === "read" ? row.readAt !== undefined : row.readAt === undefined;
}

const baseNotificationFields = {
  _id: v.id("notifications"),
  _creationTime: v.number(),
  recipientId: v.string(),
  actorId: v.string(),
  createdAt: v.number(),
  readAt: v.optional(v.number()),
  actorName: v.union(v.string(), v.null()),
  actorUsername: v.union(v.string(), v.null()),
  actorAvatarUrl: v.union(v.string(), v.null()),
};

const notificationValidator = v.union(
  v.object({
    ...baseNotificationFields,
    type: v.literal("follow"),
  }),
  v.object({
    ...baseNotificationFields,
    type: v.literal("post_like"),
    postId: v.id("posts"),
    postTitle: v.string(),
    postImageUrl: v.union(v.string(), v.null()),
  }),
  v.object({
    ...baseNotificationFields,
    type: v.literal("comment"),
    postId: v.id("posts"),
    postTitle: v.string(),
    postImageUrl: v.union(v.string(), v.null()),
    commentId: v.id("comments"),
    excerpt: v.union(v.string(), v.null()),
  }),
  v.object({
    ...baseNotificationFields,
    type: v.literal("comment_like"),
    postId: v.id("posts"),
    postTitle: v.string(),
    postImageUrl: v.union(v.string(), v.null()),
    commentId: v.id("comments"),
    excerpt: v.union(v.string(), v.null()),
  }),
);

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
  returns: v.number(),
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

/**
 * Returns the caller's notification totals for the bulk-delete dialog.
 * The scan is capped so a very large inbox does not turn the dialog
 * into an unbounded read; `truncated` tells the client to show a lower
 * bound instead of a precise count.
 *
 * Unauthenticated callers receive zeroes (fail-soft, matching
 * `getUnreadCount`).
 */
export const getNotificationCounts = query({
  args: {},
  returns: v.object({
    total: v.number(),
    read: v.number(),
    unread: v.number(),
    truncated: v.boolean(),
  }),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return { total: 0, read: 0, unread: 0, truncated: false };
    }
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_createdAt", (q) =>
        q.eq("recipientId", authUser._id),
      )
      .take(COUNT_CAP + 1);
    const truncated = rows.length > COUNT_CAP;
    const counted = truncated ? rows.slice(0, COUNT_CAP) : rows;
    const read = counted.filter((row) => row.readAt !== undefined).length;
    return {
      total: counted.length,
      read,
      unread: counted.length - read,
      truncated,
    };
  },
});

/**
 * Returns the caller's notifications, newest first, paginated. Each
 * row is hydrated with the actor's display name + avatar and, for
 * post-backed types, the post title and comment excerpt. A page may
 * span multiple actors (a reader's notifications from different
 * followed authors), so actor lookups are deduplicated per page and
 * issued via `Promise.all` over unique actor IDs — adapted from Phase
 * 1.1 rule #2 (hoist shared lookups out of paginated maps) for the
 * case where the shared value varies per row.
 *
 * Follow rows have no post. Rows whose post is missing or unpublished,
 * and comment rows whose comment no longer exists, are dropped; the
 * consuming client never sees a row with no destination.
 *
 * Unauthenticated callers receive an empty, done page (fail-soft
 * guard; the `/notifications` page redirects unauthenticated visitors
 * before they reach this query).
 *
 * @param args.paginationOpts - `PaginationOptions`: Convex pagination
 *   config (typically `{ numItems, cursor }`).
 * @returns a page of hydrated notification rows, newest first.
 */
export const getNotifications = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(notificationValidator),
  handler: async (ctx, args) => {
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 20 ||
      (args.paginationOpts.maximumRowsRead !== undefined &&
        (!Number.isSafeInteger(args.paginationOpts.maximumRowsRead) ||
          args.paginationOpts.maximumRowsRead < 1 ||
          args.paginationOpts.maximumRowsRead > 20))
    ) {
      throw new ConvexError(
        "Page size must be a safe integer between 1 and 20.",
      );
    }
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
      .paginate({ ...args.paginationOpts, maximumRowsRead: 20 });

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

    const rows = await Promise.all(
      result.page.map(async (notification) => {
        const actor = actorById.get(notification.actorId) ?? null;
        const actorFields = {
          _id: notification._id,
          _creationTime: notification._creationTime,
          recipientId: notification.recipientId,
          actorId: notification.actorId,
          createdAt: notification.createdAt,
          readAt: notification.readAt,
          actorName: actor?.displayName ?? null,
          actorUsername: actor?.username ?? null,
          actorAvatarUrl: actor?.avatarUrl ?? null,
        };

        if (notification.type === "follow") {
          return { ...actorFields, type: "follow" as const };
        }

        const post = notification.postId
          ? await ctx.db.get(notification.postId)
          : null;
        if (!post || post.status !== "published") {
          return null;
        }

        const postImageUrl = post.imageStorageId
          ? await ctx.storage.getUrl(post.imageStorageId)
          : null;

        if (notification.type === "post_like") {
          return {
            ...actorFields,
            type: "post_like" as const,
            postId: post._id,
            postTitle: post.title,
            postImageUrl,
          };
        }

        if (!notification.commentId) {
          return null;
        }
        const comment = await ctx.db.get(notification.commentId);
        return {
          ...actorFields,
          type: notification.type,
          postId: post._id,
          postTitle: post.title,
          postImageUrl,
          commentId: notification.commentId,
          excerpt: comment ? commentExcerpt(comment.body) : null,
        };
      }),
    );

    return {
      ...result,
      page: rows.filter((row) => row !== null),
    };
  },
});

/**
 * Applies the read transition for one notification to its recipient.
 * Extracted from `markRead` so the ownership, idempotence, and counter
 * rules are covered by `convex-test` without the Better Auth fixture
 * that `safeGetAuthUser` needs.
 *
 * Idempotent: a row that already carries `readAt` returns without
 * touching the counter. Ownership is enforced against the
 * server-derived recipient, and a row that belongs to someone else is
 * reported as not found rather than silently ignored.
 */
export async function applyMarkRead(
  ctx: MutationCtx,
  recipientId: string,
  notificationId: Id<"notifications">,
  readAt: number,
): Promise<void> {
  const notification = await ctx.db.get(notificationId);
  if (!notification || notification.recipientId !== recipientId) {
    throw new ConvexError("Notification not found.");
  }
  if (notification.readAt !== undefined) {
    return;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", recipientId))
    .unique();
  if (!user) {
    throw new ConvexError("User not found.");
  }
  if (
    !Number.isSafeInteger(user.unreadNotificationCount) ||
    user.unreadNotificationCount < 0
  ) {
    throw new ConvexError("Unread notification counter is invalid.");
  }
  await ctx.db.patch(notificationId, { readAt });
  await ctx.db.patch(user._id, {
    unreadNotificationCount: Math.max(0, user.unreadNotificationCount - 1),
  });
}

/**
 * Marks one notification read for its recipient. Idempotent: a row
 * that already carries `readAt` is left untouched, and the
 * denormalized `users.unreadNotificationCount` is decremented exactly
 * once per row. Rows that belong to another recipient, and ids whose
 * row no longer exists (for example after the post-deletion cascade),
 * throw `ConvexError("Notification not found.")`.
 *
 * Called by the client when a notification's post link is opened. The
 * counter stays clamped at zero for legacy drift, mirroring the
 * post-deletion cascade.
 */
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      throw new ConvexError("Unauthorized");
    }
    await applyMarkRead(ctx, authUser._id, args.notificationId, Date.now());
    return { ok: true };
  },
});

/**
 * Marks one bounded page of a recipient's notifications read through
 * `readAt` and decrements the recipient's denormalized counter by
 * exactly the rows this page transitions from unread to read.
 *
 * The invariant is one decrement per unread-to-read transition,
 * whichever path performs it. `markAllRead` must therefore not reset
 * the counter to zero while later batches still leave rows unread: a
 * per-row mark on one of those rows would then consume a newer
 * arrival's count. Once the watermark is exhausted, a final
 * reconciliation zeroes the counter only when no notification arrived
 * after it, which also heals stale over-counts.
 *
 * Exported for the `convex-test` regression, since the `markAllRead`
 * handler is behind the Better Auth fixture.
 */
export async function applyReadBatch(
  ctx: MutationCtx,
  args: {
    recipientId: string;
    readAt: number;
    paginationOpts: PaginationOptions;
  },
): Promise<{ isDone: boolean; continueCursor: string }> {
  const result = await ctx.db
    .query("notifications")
    .withIndex("by_recipientId_and_createdAt", (q) =>
      q.eq("recipientId", args.recipientId).lte("createdAt", args.readAt),
    )
    .paginate({
      ...args.paginationOpts,
      maximumRowsRead: READ_BATCH_SIZE,
    });

  let transitioned = 0;
  for (const notification of result.page) {
    if (notification.readAt === undefined) {
      await ctx.db.patch(notification._id, { readAt: args.readAt });
      transitioned += 1;
    }
  }

  if (transitioned > 0 || result.isDone) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.recipientId))
      .unique();
    if (user) {
      if (
        !Number.isSafeInteger(user.unreadNotificationCount) ||
        user.unreadNotificationCount < 0
      ) {
        throw new ConvexError("Unread notification counter is invalid.");
      }
      let nextUnread = Math.max(0, user.unreadNotificationCount - transitioned);
      if (result.isDone) {
        // The watermark is exhausted. When nothing arrived after it,
        // every notification is read and the counter must be zero.
        // This also heals stale over-counts without inventing state.
        const newer = await ctx.db
          .query("notifications")
          .withIndex("by_recipientId_and_createdAt", (q) =>
            q.eq("recipientId", args.recipientId).gt("createdAt", args.readAt),
          )
          .take(1);
        if (newer.length === 0) {
          nextUnread = 0;
        }
      }
      await ctx.db.patch(user._id, { unreadNotificationCount: nextUnread });
    }
  }

  return { isDone: result.isDone, continueCursor: result.continueCursor };
}

export const dismiss = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      throw new ConvexError("Unauthorized");
    }
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.recipientId !== authUser._id) {
      throw new ConvexError("Notification not found.");
    }
    if (notification.readAt === undefined) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
        .unique();
      if (user) {
        if (
          !Number.isSafeInteger(user.unreadNotificationCount) ||
          user.unreadNotificationCount < 0
        ) {
          throw new ConvexError("Unread notification counter is invalid.");
        }
        await ctx.db.patch(user._id, {
          unreadNotificationCount: Math.max(
            0,
            user.unreadNotificationCount - 1,
          ),
        });
      }
    }
    await ctx.db.delete(args.notificationId);
    return null;
  },
});

/**
 * Starts a scoped bulk delete. The snapshot watermark is captured now,
 * and the batched sweep only touches rows created at or before it, so a
 * notification created after this call survives with its own counter
 * increment.
 */
export const dismissAll = mutation({
  args: {
    scope: dismissScopeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      throw new ConvexError("Unauthorized");
    }
    await ctx.scheduler.runAfter(0, internal.notifications.dismissBatch, {
      recipientId: authUser._id,
      scope: args.scope,
      watermark: Date.now(),
      cursor: null,
    });
    return null;
  },
});

/**
 * Applies one bounded page of a scoped bulk delete and self-schedules
 * until the snapshot is exhausted. Each removed unread row decrements
 * the recipient's badge; read rows leave it alone.
 */
export const dismissBatch = internalMutation({
  args: {
    recipientId: v.string(),
    scope: dismissScopeValidator,
    watermark: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    deleted: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_createdAt", (q) =>
        q.eq("recipientId", args.recipientId).lte("createdAt", args.watermark),
      )
      .paginate({ numItems: DISMISS_BATCH_SIZE, cursor: args.cursor });

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.recipientId))
      .unique();
    if (
      user &&
      (!Number.isSafeInteger(user.unreadNotificationCount) ||
        user.unreadNotificationCount < 0)
    ) {
      throw new ConvexError("Unread notification counter is invalid.");
    }

    let deleted = 0;
    let unreadDeleted = 0;
    for (const row of page.page) {
      if (!matchesDismissScope(row, args.scope)) {
        continue;
      }
      if (row.readAt === undefined) {
        unreadDeleted += 1;
      }
      await ctx.db.delete(row._id);
      deleted += 1;
    }

    if (user && unreadDeleted > 0) {
      await ctx.db.patch(user._id, {
        unreadNotificationCount: Math.max(
          0,
          user.unreadNotificationCount - unreadDeleted,
        ),
      });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.notifications.dismissBatch, {
        ...args,
        cursor: page.continueCursor,
      });
    }
    return {
      deleted,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * Marks every notification through now as read for the caller in
 * bounded batches. The first batch is applied in this transaction;
 * later batches continue through `markReadBatch`. Each batch
 * decrements the denormalized `users.unreadNotificationCount` by
 * exactly the rows it transitions, so the badge drops to 0 as the
 * batches complete without ever under-counting a notification that
 * arrives mid-run. The rows in the `notifications` table are NOT
 * deleted — they remain as visual history for the paginated list.
 *
 * @returns `{ ok: true }` on success.
 * @throws `ConvexError("Unauthorized")` if the caller has no session.
 * @throws `ConvexError("User not found.")` if the caller's app-level
 *   `users` doc does not exist (AuthSync race guard, same as
 *   `toggleFollow`).
 */
export const markAllRead = mutation({
  args: {},
  returns: v.object({ ok: v.literal(true) }),
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
    if (
      !Number.isSafeInteger(user.unreadNotificationCount) ||
      user.unreadNotificationCount < 0
    ) {
      throw new ConvexError("Unread notification counter is invalid.");
    }
    const readAt = Date.now();
    const firstBatch = await applyReadBatch(ctx, {
      recipientId: authUser._id,
      readAt,
      paginationOpts: { numItems: READ_BATCH_SIZE, cursor: null },
    });
    if (!firstBatch.isDone) {
      await ctx.scheduler.runAfter(0, internal.notifications.markReadBatch, {
        recipientId: authUser._id,
        readAt,
        paginationOpts: {
          numItems: READ_BATCH_SIZE,
          cursor: firstBatch.continueCursor,
        },
      });
    }
    return { ok: true };
  },
});

/**
 * Applies one bounded continuation batch of a bulk read and
 * self-schedules the next batch until the watermark is exhausted.
 * Shares `applyReadBatch` with `markAllRead` so the counter is
 * decremented once per transition on every path.
 */
export const markReadBatch = internalMutation({
  args: {
    recipientId: v.string(),
    readAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await applyReadBatch(ctx, {
      recipientId: args.recipientId,
      readAt: args.readAt,
      paginationOpts: args.paginationOpts,
    });
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.notifications.markReadBatch, {
        ...args,
        paginationOpts: {
          numItems: args.paginationOpts.numItems,
          cursor: result.continueCursor,
        },
      });
    }
    return null;
  },
});
