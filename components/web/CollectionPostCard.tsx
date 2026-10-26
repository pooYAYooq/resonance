import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { CollectionPostSummary } from "@/convex/postSummary";
import { buildProfilePath } from "@/lib/username";
import { CoverImage } from "./CoverImage";
import { UserAvatar } from "./UserAvatar";
import { LikeButton } from "./LikeButton";
import { BookmarkButton } from "./BookmarkButton";
import { TagPill } from "./TagPill";

type CollectionPostCardProps = Omit<
  CollectionPostSummary,
  "_id" | "body" | "createdAt" | "addedAt"
> & {
  postId: CollectionPostSummary["_id"];
  collection: "saved" | "liked";
};

/** A compact return path to a post in a reader's private collection. */
export function CollectionPostCard({
  postId,
  title,
  imageUrl,
  authorId,
  authorName,
  authorUsername,
  authorAvatarUrl,
  tags,
  likeCount,
  isLiked,
  isBookmarked,
  collection,
}: CollectionPostCardProps) {
  const postHref = `/blog/${postId}`;
  const displayName = authorName?.trim() || "Unknown";
  const profileHref = authorUsername ? buildProfilePath(authorUsername) : null;

  return (
    <Card className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 rounded-none border-b border-border/70 bg-transparent p-0 pt-3 pb-4 shadow-none ring-0 overflow-visible last:border-b-0 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4 sm:rounded-md sm:border-0 sm:bg-card sm:p-4 sm:shadow-xs sm:ring-1 sm:overflow-hidden sm:transition-colors sm:hover:bg-muted/50 sm:focus-within:bg-muted/50 xl:h-full">
      <div className="col-start-1 row-start-1 relative aspect-[3/2] w-[96px] shrink-0 self-start overflow-hidden rounded-sm bg-muted sm:w-28">
        <CoverImage
          src={imageUrl}
          alt=""
          sizes="(min-width: 640px) 112px, 96px"
          className="object-cover"
        />
      </div>
      <div className="col-start-2 row-start-1 flex min-w-0 flex-col gap-2 self-stretch">
        <h2 className="text-[15px] font-semibold leading-snug sm:text-base">
          <Link
            href={postHref}
            className="line-clamp-2 break-words hover:text-primary hover:underline"
          >
            {title}
          </Link>
        </h2>
        <div className="flex min-w-0 items-center justify-between gap-1.5 sm:gap-3">
          <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground sm:text-sm">
            <UserAvatar
              userId={authorId}
              name={displayName}
              avatarUrl={authorAvatarUrl}
              className="size-6 shrink-0 sm:size-[30px]"
            />
            {profileHref ? (
              <Link
                href={profileHref}
                title={displayName}
                className="min-w-0 max-w-[20ch] truncate hover:text-primary hover:underline"
              >
                {displayName}
              </Link>
            ) : (
              <span
                title={displayName}
                className="min-w-0 max-w-[20ch] truncate"
              >
                {displayName}
              </span>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* Saved exposes Save; Liked exposes Like. */}
            {collection === "saved" ? (
              <BookmarkButton
                postId={postId}
                postTitle={title}
                isBookmarked={isBookmarked}
                presentation="icon"
              />
            ) : (
              <LikeButton
                postId={postId}
                postTitle={title}
                isLiked={isLiked}
                likeCount={likeCount}
                presentation="icon"
              />
            )}
          </div>
        </div>
      </div>
      {tags.length > 0 && (
        <div className="col-span-2 row-start-2 hidden flex-wrap items-center gap-1.5 sm:flex">
          {tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      )}
    </Card>
  );
}
