import Link from "next/link";
import { formatPostDate, formatRelativeTime } from "@/lib/relative-time";
import { buildProfilePath } from "@/lib/username";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";

const AVATAR_SIZE_CLASSES = {
  sm: "size-6",
  md: "size-6 sm:size-[30px]",
} as const;

type PostAuthorLineProps = {
  authorId: string;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl?: string | null;
  date?: number | null;
  dateMode?: "relative" | "absolute";
  now?: number;
  avatarSize?: keyof typeof AVATAR_SIZE_CLASSES;
  nameClassName?: string;
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
  avatarSize = "sm",
  nameClassName,
  className,
}: PostAuthorLineProps) {
  const displayName = authorName?.trim() || "Unknown";
  const profileHref = authorUsername ? buildProfilePath(authorUsername) : null;
  const dateValue = typeof date === "number" ? date : null;
  const dateLabel =
    dateValue !== null && dateMode
      ? dateMode === "relative"
        ? // eslint-disable-next-line react-hooks/purity -- Fallback display time when the caller does not pin `now`
          formatRelativeTime(dateValue, now ?? Date.now())
        : formatPostDate(dateValue)
      : null;

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
        className={cn(AVATAR_SIZE_CLASSES[avatarSize], "shrink-0")}
      />
      {profileHref ? (
        <Link
          href={profileHref}
          title={displayName}
          className={cn(
            "truncate font-medium text-foreground hover:text-primary hover:underline",
            nameClassName,
          )}
        >
          {displayName}
        </Link>
      ) : (
        <span
          title={displayName}
          className={cn("truncate font-medium text-foreground", nameClassName)}
        >
          {displayName}
        </span>
      )}
      {dateValue !== null && dateLabel ? (
        <>
          <span aria-hidden="true">·</span>
          <time
            dateTime={new Date(dateValue).toISOString()}
            title={
              dateMode === "relative" ? formatPostDate(dateValue) : undefined
            }
            className="shrink-0"
          >
            {dateLabel}
          </time>
        </>
      ) : null}
    </div>
  );
}
