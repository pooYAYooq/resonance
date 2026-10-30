import Link from "next/link";
import { formatPostDate, formatRelativeTime } from "@/lib/relative-time";
import { buildProfilePath } from "@/lib/username";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";

type PostAuthorLineProps = {
  authorId: string;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl?: string | null;
  date: number;
  dateMode: "relative" | "absolute";
  now?: number;
  className?: string;
};

export function PostAuthorLine({
  authorId,
  authorName,
  authorUsername,
  authorAvatarUrl,
  date,
  dateMode,
  now,
  className,
}: PostAuthorLineProps) {
  const displayName = authorName?.trim() || "Unknown";
  const profileHref = authorUsername ? buildProfilePath(authorUsername) : null;
  const dateLabel =
    dateMode === "relative"
      ? // eslint-disable-next-line react-hooks/purity -- Fallback display time when the caller does not pin `now`
        formatRelativeTime(date, now ?? Date.now())
      : formatPostDate(date);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <UserAvatar
        userId={authorId}
        name={displayName}
        avatarUrl={authorAvatarUrl}
        className="size-6 shrink-0"
      />
      {profileHref ? (
        <Link
          href={profileHref}
          className="truncate font-medium text-foreground hover:text-primary hover:underline"
        >
          {displayName}
        </Link>
      ) : (
        <span className="truncate font-medium text-foreground">
          {displayName}
        </span>
      )}
      <span aria-hidden="true">·</span>
      <time
        dateTime={new Date(date).toISOString()}
        title={dateMode === "relative" ? formatPostDate(date) : undefined}
        className="shrink-0"
      >
        {dateLabel}
      </time>
    </div>
  );
}
