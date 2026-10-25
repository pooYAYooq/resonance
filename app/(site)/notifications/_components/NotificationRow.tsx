"use client";

/**
 * Pure-presentational row for a single notification on `/notifications`.
 * Mirrors `CommentCard`'s pure-presentational stance: no Convex hooks,
 * receives a fully-hydrated notification object and renders the actor,
 * the event copy, the destination, and the timestamp, plus a compact
 * unread indicator while `readAt` is unset. Post details expand independently;
 * explicitly expanding a row marks it read; restoring saved expansion does not.
 *
 * The row itself never mutates anything: activating the row's primary
 * destination reports the notification id through `onActivate`, and the
 * owning list calls `api.notifications.markRead`. A follow row's primary
 * destination is the actor profile; the other types link to the post,
 * with comment actions opening the focused conversation.
 *
 * Actor names and avatars open the profile. Article titles and covers open
 * the full post; comment events and excerpts open the focused conversation.
 *
 * Relative timestamp: uses `Intl.RelativeTimeFormat` when available
 * (the spec deliberately leaves the formatter open; any reasonable
 * one is fine). The fallback for the first 60 seconds is "just now";
 * otherwise formats the absolute difference in seconds / minutes /
 * hours / days.
 */

import { useId, useSyncExternalStore } from "react";
import { Check, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { NotificationLink as Link } from "@/components/web/NotificationLink";
import { FollowButton } from "@/components/web/FollowButton";
import {
  notificationExpansionKey,
  readExpansion,
  subscribeToExpansion,
  toggleExpansion,
  collapsedOnServer,
} from "./notificationExpansion";
import { CoverImage } from "@/components/web/CoverImage";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/web/UserAvatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Id } from "@/convex/_generated/dataModel";
import { buildProfilePath } from "@/lib/username";

type NotificationBase = {
  _id: Id<"notifications">;
  _creationTime: number;
  recipientId: string;
  actorId: string;
  createdAt: number;
  readAt?: number;
  actorName: string | null;
  actorUsername: string | null;
  actorAvatarUrl: string | null;
};

export type NotificationRowData =
  | (NotificationBase & { type: "follow" })
  | (NotificationBase & {
      type: "post_like";
      postId: Id<"posts">;
      postTitle: string;
      postImageUrl?: string | null;
    })
  | (NotificationBase & {
      type: "comment";
      postId: Id<"posts">;
      postTitle: string;
      postImageUrl?: string | null;
      commentId: Id<"comments">;
      excerpt: string | null;
    })
  | (NotificationBase & {
      type: "comment_like";
      postId: Id<"posts">;
      postTitle: string;
      postImageUrl?: string | null;
      commentId: Id<"comments">;
      excerpt: string | null;
    });

interface NotificationRowProps {
  notification: NotificationRowData;
  /** Reports that this row's primary destination was activated. */
  onActivate?: (notificationId: Id<"notifications">) => void;
  /** Deletes this row from its row action. */
  onDelete?: (notificationId: Id<"notifications">) => void;
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

function formatShortRelativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo`;
  return `${Math.floor(seconds / 31536000)}y`;
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

export function NotificationRow({
  notification,
  onActivate,
  onDelete,
}: NotificationRowProps) {
  const displayName = notification.actorName?.trim() || "Someone";
  const profileHref = notification.actorUsername
    ? buildProfilePath(notification.actorUsername)
    : null;
  const isUnread = notification.readAt === undefined;
  const commentHref =
    notification.type === "comment" || notification.type === "comment_like"
      ? `/blog/${notification.postId}/comments/${notification.commentId}`
      : null;
  const actionHref =
    notification.type === "post_like"
      ? `/blog/${notification.postId}`
      : commentHref;
  const actionLinkClass =
    "relative z-10 pointer-events-auto underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground";
  const actionLink = (text: string, href: string) => (
    <Link href={href} className={actionLinkClass}>
      {text}
    </Link>
  );

  const postHref =
    notification.type === "follow" ? null : `/blog/${notification.postId}`;

  const expansionKey = notificationExpansionKey(notification);
  const expanded = useSyncExternalStore(
    subscribeToExpansion,
    () => readExpansion(expansionKey),
    collapsedOnServer,
  );
  const detailsId = useId();
  const hasDetails = notification.type !== "follow";

  const cardClassName = cn(
    "min-w-0 w-full rounded-sm border border-border p-1 transition-colors hover:bg-muted/50 focus-within:bg-muted/50",
    isUnread ? "bg-muted/50" : "bg-card",
  );

  const handleActivate = () => {
    if (isUnread) onActivate?.(notification._id);
  };
  // eslint-disable-next-line react-hooks/purity -- Display relative time when the row renders
  const now = Date.now();
  const relative = formatRelativeTime(notification.createdAt, now);

  return (
    <article
      className="group/notification relative w-[44rem] max-w-full max-sm:border-t max-sm:border-border max-sm:first:border-t-0"
      onClickCapture={(event) => {
        // Opening an actions menu should leave its explicit read action available.
        if (
          event.target instanceof Element &&
          event.target.closest('button[aria-haspopup="menu"], [role="menu"]')
        )
          return;
        handleActivate();
      }}
      onAuxClickCapture={(event) => {
        if (event.button === 1) handleActivate();
      }}
    >
      <div
        data-testid="notification-mobile"
        className={cn(
          "-mx-4 grid grid-cols-[42px_minmax(0,1fr)] gap-x-2 px-4 py-3 transition-colors sm:hidden",
          isUnread && "bg-muted/50",
        )}
      >
        {/* A: Avatar, actor, and action. */}
        <div className="col-span-2 row-start-1 flex items-center gap-2">
          {profileHref ? (
            <Link
              href={profileHref}
              aria-label={`Open ${displayName}'s profile`}
              className="shrink-0 self-start rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <UserAvatar
                userId={notification.actorId}
                name={displayName}
                avatarUrl={notification.actorAvatarUrl}
                className="size-[42px] shrink-0"
              />
            </Link>
          ) : (
            <UserAvatar
              userId={notification.actorId}
              name={displayName}
              avatarUrl={notification.actorAvatarUrl}
              className="size-[42px] shrink-0 self-start"
            />
          )}
          <p className="min-w-0 flex-1 line-clamp-2 break-words text-sm leading-tight text-muted-foreground">
            {profileHref ? (
              <Link
                href={profileHref}
                className="inline-block max-w-full truncate align-bottom font-semibold text-foreground hover:underline"
              >
                {displayName}
              </Link>
            ) : (
              <span className="inline-block max-w-full truncate align-bottom font-semibold text-foreground">
                {displayName}
              </span>
            )}{" "}
            <span>
              {notification.type === "follow"
                ? "started following you"
                : notification.type === "comment"
                  ? "commented on:"
                  : notification.type === "comment_like"
                    ? "liked your comment on:"
                    : "liked your post:"}
            </span>
          </p>
        </div>
        {/* B: Post cover and title, indented past the avatar column. */}
        {notification.type !== "follow" && (
          <Link
            href={postHref!}
            className="col-start-2 row-start-2 mt-0.5 flex min-w-0 items-center gap-2 rounded-md text-sm leading-tight text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Open ${notification.postTitle}`}
          >
            <span className="relative h-[49.5px] w-[88px] shrink-0 overflow-hidden rounded bg-muted">
              <CoverImage
                src={notification.postImageUrl}
                alt=""
                sizes="88px"
                className="object-cover"
              />
            </span>
            <span className="min-w-0 flex-1 line-clamp-2 break-words">
              {notification.postTitle}
            </span>
          </Link>
        )}
        {/* C: Comment excerpt. */}
        {(notification.type === "comment" ||
          notification.type === "comment_like") &&
          notification.excerpt && (
            <p className="col-start-2 row-start-3 mt-2 line-clamp-2 min-w-0 break-words text-sm leading-tight italic text-foreground">
              “
              <Link
                href={commentHref!}
                className="hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {notification.excerpt}
              </Link>
              ”
            </p>
          )}
        {/* D: Time, unread state, and actions. */}
        <div className="col-start-2 row-start-4 flex min-h-8 min-w-0 flex-wrap items-center justify-between gap-x-2">
          <div className="flex items-center gap-2 text-xs">
            <time
              dateTime={new Date(notification.createdAt).toISOString()}
              className="whitespace-nowrap text-xs text-muted-foreground"
              aria-label={relative}
              title={relative}
            >
              {formatShortRelativeTime(notification.createdAt, now)}
            </time>
            <span
              role="img"
              aria-label={isUnread ? "Unread" : undefined}
              aria-hidden={!isUnread}
              className="inline-flex size-4 shrink-0 items-center justify-center"
            >
              <span
                className={cn(
                  "size-1.5 translate-y-[1.5px] rounded-full bg-primary",
                  !isUnread && "invisible",
                )}
              />
            </span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {notification.type === "follow" && notification.actorUsername && (
              <div className="[&_button]:size-8">
                <FollowButton
                  profileUserId={notification.actorId}
                  authorName={displayName}
                  isFollowing={false}
                  size="sm"
                  followLabel="Follow back"
                  presentation="icon"
                />
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full"
                  aria-label={`Actions for notification from ${displayName}`}
                >
                  <MoreHorizontal aria-hidden="true" className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="left"
                align="center"
                className="min-w-48 whitespace-nowrap"
              >
                <DropdownMenuGroup>
                  {isUnread && (
                    <DropdownMenuItem onSelect={handleActivate}>
                      <Check aria-hidden="true" />
                      Mark as read
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      handleActivate();
                      onDelete?.(notification._id);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete notification
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div
        data-testid="notification-desktop"
        className={cn(cardClassName, "hidden sm:block")}
      >
        <div className="relative flex min-w-0 items-center gap-3">
          {hasDetails && (
            <button
              type="button"
              className="absolute inset-0 z-0 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`${expanded ? "Collapse" : "Expand"} notification from ${displayName}`}
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => {
                toggleExpansion(expansionKey);
              }}
            />
          )}
          {profileHref ? (
            <Link
              href={profileHref}
              aria-label={`Open ${displayName}'s profile`}
              className="relative z-10"
            >
              <UserAvatar
                userId={notification.actorId}
                name={displayName}
                avatarUrl={notification.actorAvatarUrl}
                className="size-10 shrink-0"
              />
            </Link>
          ) : (
            <UserAvatar
              userId={notification.actorId}
              name={displayName}
              avatarUrl={notification.actorAvatarUrl}
              className="size-10 shrink-0"
            />
          )}
          <div className="pointer-events-none flex min-w-0 flex-1 items-baseline gap-2 break-words">
            <p className="flex min-w-0 items-baseline gap-1 text-sm text-muted-foreground">
              {profileHref ? (
                <Link
                  href={profileHref}
                  className="pointer-events-auto relative z-10 min-w-0 max-w-60 truncate font-semibold text-foreground hover:underline"
                >
                  {displayName}
                </Link>
              ) : (
                <span className="min-w-0 max-w-60 truncate font-semibold text-foreground">
                  {displayName}
                </span>
              )}
              <span className="shrink-0 whitespace-nowrap">
                {notification.type === "follow" ? (
                  "started following you"
                ) : (
                  <>
                    {actionLink(
                      notification.type === "comment" ? "commented" : "liked",
                      actionHref!,
                    )}
                    {notification.type === "comment" ? " on your " : " your "}
                    {notification.type === "comment_like"
                      ? actionLink("comment", commentHref!)
                      : actionLink("post", `/blog/${notification.postId}`)}
                  </>
                )}
              </span>
            </p>
            <span
              aria-hidden="true"
              className="shrink-0 text-sm text-muted-foreground"
            >
              ·
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <time
                dateTime={new Date(notification.createdAt).toISOString()}
                className="whitespace-nowrap text-xs"
                aria-label={relative}
                title={relative}
              >
                {formatShortRelativeTime(notification.createdAt, now)}
              </time>
              <span className="inline-flex size-4 shrink-0 items-center justify-center">
                {notification.type === "follow" ? (
                  <button
                    type="button"
                    aria-label="Mark as read"
                    title="Mark as read"
                    disabled={!isUnread}
                    aria-hidden={!isUnread}
                    className={cn(
                      "pointer-events-auto relative z-10 inline-flex size-4 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      !isUnread && "invisible",
                    )}
                  >
                    <span
                      role="img"
                      aria-label={isUnread ? "Unread" : undefined}
                      aria-hidden={!isUnread}
                      className="size-1.5 translate-y-[1.5px] rounded-full bg-primary"
                    />
                  </button>
                ) : (
                  <span
                    role="img"
                    aria-label={isUnread ? "Unread" : undefined}
                    aria-hidden={!isUnread}
                    className={cn(
                      "size-1.5 translate-y-[1.5px] rounded-full bg-primary",
                      !isUnread && "invisible",
                    )}
                  />
                )}
              </span>
            </span>
          </div>
          {notification.type === "follow" && notification.actorUsername && (
            <div className="relative z-10 shrink-0">
              <FollowButton
                profileUserId={notification.actorId}
                authorName={displayName}
                isFollowing={false}
                size="sm"
                followLabel="Follow back"
                presentation="icon"
              />
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete notification"
            title="Delete notification"
            className="relative z-10 cursor-pointer text-muted-foreground transition-opacity hover:text-destructive focus-visible:text-destructive [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/notification:pointer-events-auto [@media(hover:hover)]:group-hover/notification:opacity-100 [@media(hover:hover)]:focus-visible:pointer-events-auto [@media(hover:hover)]:focus-visible:opacity-100"
            onClick={() => onDelete?.(notification._id)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
        {notification.type !== "follow" && (
          <div id={detailsId} hidden={!expanded}>
            <div className="-mx-1 mt-1">
              <Separator />
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row-reverse sm:items-start sm:pl-13">
              <div className="min-w-0 flex-1 break-words">
                {notification.type === "post_like" ? (
                  <Link
                    href={postHref!}
                    className="mt-1 inline-block text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                  >
                    {notification.postTitle}
                  </Link>
                ) : (
                  <>
                    {notification.excerpt && (
                      <blockquote className="mt-2 border-l-2 border-border pl-4 text-sm italic text-foreground">
                        <Link
                          href={commentHref!}
                          className="rounded-sm hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {notification.excerpt}
                        </Link>
                      </blockquote>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">
                      on:{" "}
                      <Link
                        href={postHref!}
                        className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                      >
                        {notification.postTitle}
                      </Link>
                    </p>
                  </>
                )}
              </div>
              <Link
                href={`/blog/${notification.postId}`}
                aria-label={`Open ${notification.postTitle}`}
                className="relative aspect-video w-full shrink-0 overflow-hidden rounded bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-[425px]:hidden sm:w-48"
              >
                <CoverImage
                  src={notification.postImageUrl}
                  alt=""
                  sizes="(min-width: 640px) 192px, 100vw"
                  className="object-cover"
                />
              </Link>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
