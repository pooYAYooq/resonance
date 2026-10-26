/**
 * The single write path for engagement notifications.
 *
 * Every causing mutation (like, follow, comment, comment-like) calls
 * `recordEngagementNotification` inside its own transaction, so the action and
 * the notification commit or roll back together. One event has one recipient,
 * unlike the removed follower fan-out.
 *
 * Rules enforced here, so call sites cannot drift:
 *  - self-actions write nothing;
 *  - follows notify at most once per actor/recipient pair per seven days;
 *  - other events keep one live row per (recipient, actor, dedupeKey);
 *  - repeated actions never resurrect an existing read row.
 */
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  rateLimiter,
  FOLLOW_NOTIFICATION_LIMIT,
  FOLLOW_NOTIFICATION_PERIOD_MS,
} from "./rateLimiter";

export const EXCERPT_LIMIT = 90;

const EXCERPT_ELLIPSIS = "...";

export type EngagementEvent =
  | { type: "follow"; recipientId: string; actorId: string }
  | {
      type: "post_like";
      recipientId: string;
      actorId: string;
      postId: Id<"posts">;
    }
  | {
      type: "comment";
      recipientId: string;
      actorId: string;
      postId: Id<"posts">;
      commentId: Id<"comments">;
    }
  | {
      type: "comment_like";
      recipientId: string;
      actorId: string;
      postId: Id<"posts">;
      commentId: Id<"comments">;
    };

/** Collapses a comment body to one line and bounds its display length. */
export function commentExcerpt(body: string): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  if (collapsed.length <= EXCERPT_LIMIT) {
    return collapsed;
  }

  const room = EXCERPT_LIMIT - EXCERPT_ELLIPSIS.length;
  const sliced = collapsed.slice(0, room);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut}${EXCERPT_ELLIPSIS}`;
}

export function engagementDedupeKey(event: EngagementEvent): string {
  switch (event.type) {
    case "follow":
      return `follow:${event.actorId}`;
    case "post_like":
      return `post_like:${event.postId}`;
    case "comment":
      return `comment:${event.commentId}`;
    case "comment_like":
      return `comment_like:${event.commentId}`;
  }
}

export async function recordEngagementNotification(
  ctx: MutationCtx,
  event: EngagementEvent,
): Promise<boolean> {
  if (event.recipientId === event.actorId) {
    return false;
  }

  const dedupeKey = engagementDedupeKey(event);
  const lookup = ctx.db
    .query("notifications")
    .withIndex("by_recipientId_and_actorId_and_dedupeKey", (q) =>
      q
        .eq("recipientId", event.recipientId)
        .eq("actorId", event.actorId)
        .eq("dedupeKey", dedupeKey),
    );
  if (event.type === "follow") {
    const key = JSON.stringify([event.recipientId, event.actorId]);
    const state = await rateLimiter.getValue(ctx, FOLLOW_NOTIFICATION_LIMIT, {
      key,
    });
    // Initialize existing pairs from their last delivered notification. ts=0
    // is the component's documented empty-state value; later deletion must
    // not reset the allowance stored independently by the component.
    if (state.ts === 0) {
      const latest = await lookup.order("desc").first();
      if (latest) {
        const remaining =
          latest.createdAt + FOLLOW_NOTIFICATION_PERIOD_MS - Date.now();
        if (remaining > 0) {
          await rateLimiter.limit(ctx, FOLLOW_NOTIFICATION_LIMIT, {
            key,
            count: Math.min(1, remaining / FOLLOW_NOTIFICATION_PERIOD_MS),
          });
          return false;
        }
      }
    }
    const allowance = await rateLimiter.limit(ctx, FOLLOW_NOTIFICATION_LIMIT, {
      key,
    });
    if (!allowance.ok) return false;
  } else if (await lookup.unique()) {
    return false;
  }

  const recipient = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", event.recipientId))
    .unique();
  if (
    recipient &&
    (!Number.isSafeInteger(recipient.unreadNotificationCount) ||
      recipient.unreadNotificationCount < 0 ||
      recipient.unreadNotificationCount === Number.MAX_SAFE_INTEGER)
  ) {
    throw new ConvexError("Unread notification counter is invalid.");
  }

  const row: {
    recipientId: string;
    actorId: string;
    type: EngagementEvent["type"];
    dedupeKey: string;
    createdAt: number;
    postId?: Id<"posts">;
    commentId?: Id<"comments">;
  } = {
    recipientId: event.recipientId,
    actorId: event.actorId,
    type: event.type,
    dedupeKey,
    createdAt: Date.now(),
  };
  if (event.type !== "follow") {
    row.postId = event.postId;
  }
  if (event.type === "comment" || event.type === "comment_like") {
    row.commentId = event.commentId;
  }

  await ctx.db.insert("notifications", row);

  if (recipient) {
    await ctx.db.patch(recipient._id, {
      unreadNotificationCount: recipient.unreadNotificationCount + 1,
    });
  }
  return true;
}
