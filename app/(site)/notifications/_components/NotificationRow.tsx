/**
 * Pure-presentational row for a single notification on `/notifications`.
 * Mirrors `CommentCard`'s pure-presentational stance: no Convex hooks,
 * receives a fully-hydrated notification object and renders the
 * actor + post + timestamp.
 *
 * Phase 1.1 rule #3: the post title is an `<h2>` link because the
 * page-level `<h1>` ("Notifications") is the page's only `<h1>`. The
 * row's actor name links to the actor's profile (`/u/[actorId]`).
 *
 * Relative timestamp: uses `Intl.RelativeTimeFormat` when available
 * (the spec deliberately leaves the formatter open; any reasonable
 * one is fine). The fallback for the first 60 seconds is "just now";
 * otherwise formats the absolute difference in seconds / minutes /
 * hours / days.
 */

import Link from "next/link";
import { UserAvatar } from "@/components/web/UserAvatar";
import type { Id } from "@/convex/_generated/dataModel";

export interface NotificationRowData {
  _id: Id<"notifications">;
  _creationTime: number;
  recipientId: string;
  actorId: string;
  postId: Id<"posts">;
  createdAt: number;
  actorName: string | null;
  actorAvatarUrl: string | null;
  postTitle: string;
}

interface NotificationRowProps {
  notification: NotificationRowData;
}

const RELATIVE_THRESHOLDS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60 * 60],
  ["hour", 60 * 60 * 24],
  ["day", 60 * 60 * 24 * 30],
  ["month", 60 * 60 * 24 * 365],
  ["year", Infinity],
];

function formatRelativeTime(timestamp: number, now: number): string {
  const diffMs = timestamp - now;
  const diffSeconds = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSeconds);

  if (abs < 5) {
    return "just now";
  }

  for (const [unit, threshold] of RELATIVE_THRESHOLDS) {
    if (abs < threshold) {
      const value = Math.round(diffSeconds / thresholdDivisor(unit));
      try {
        return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
          value,
          unit,
        );
      } catch {
        return new Date(timestamp).toLocaleDateString();
      }
    }
  }
  return new Date(timestamp).toLocaleDateString();
}

function thresholdDivisor(unit: Intl.RelativeTimeFormatUnit): number {
  switch (unit) {
    case "second":
      return 1;
    case "minute":
      return 60;
    case "hour":
      return 60 * 60;
    case "day":
      return 60 * 60 * 24;
    case "month":
      return 60 * 60 * 24 * 30;
    case "year":
      return 60 * 60 * 24 * 365;
    default:
      return 1;
  }
}

export function NotificationRow({ notification }: NotificationRowProps) {
  const displayName = notification.actorName?.trim() || "Someone";
  const postHref = `/blog/${notification.postId}`;
  const profileHref = `/u/${notification.actorId}`;
  // eslint-disable-next-line react-hooks/purity -- Server Component, single render on the server
  const now = Date.now();
  const relative = formatRelativeTime(notification.createdAt, now);

  return (
    <article className="flex items-start gap-3 border-b py-4 last:border-b-0">
      <Link href={profileHref} aria-label={`Open ${displayName}'s profile`}>
        <UserAvatar
          userId={notification.actorId}
          name={displayName}
          avatarUrl={notification.actorAvatarUrl}
          className="size-10 shrink-0"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">
          <Link
            href={profileHref}
            className="font-semibold text-foreground hover:underline"
          >
            {displayName}
          </Link>{" "}
          published a new post
        </p>
        <Link href={postHref} className="block mt-1">
          <h2 className="text-lg font-semibold hover:text-primary">
            {notification.postTitle}
          </h2>
        </Link>
        <time
          dateTime={new Date(notification.createdAt).toISOString()}
          className="text-xs text-muted-foreground mt-1 block"
        >
          {relative}
        </time>
      </div>
    </article>
  );
}
