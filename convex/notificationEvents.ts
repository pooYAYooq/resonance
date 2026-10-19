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
 *  - one row per (recipient, actor, dedupeKey), forever;
 *  - a repeat action never resurrects a read row or bumps the counter.
 */
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const EXCERPT_LIMIT = 140;

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
  return `${collapsed.slice(0, EXCERPT_LIMIT - 3).trimEnd()}...`;
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
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_recipientId_and_actorId_and_dedupeKey", (q) =>
      q
        .eq("recipientId", event.recipientId)
        .eq("actorId", event.actorId)
        .eq("dedupeKey", dedupeKey),
    )
    .unique();
  if (existing) {
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
