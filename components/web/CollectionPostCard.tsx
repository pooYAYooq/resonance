import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { CollectionPostSummary } from "@/convex/postSummary";
import { CoverImage } from "./CoverImage";
import { PostCardCover } from "./PostCardCover";
import { PostAuthorLine } from "./PostAuthorLine";
import { PostTags } from "./PostTags";
import { LikeButton } from "./LikeButton";
import { BookmarkButton } from "./BookmarkButton";

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

  return (
    <Card className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 rounded-none border-b border-border/70 bg-transparent p-0 pt-3 pb-4 shadow-none ring-0 overflow-visible last:border-b-0 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4 sm:rounded-sm sm:border-0 sm:bg-card sm:p-4 sm:shadow-xs sm:ring-1 sm:overflow-hidden sm:transition-colors sm:hover:bg-muted/50 sm:focus-within:bg-muted/50 xl:h-full">
      <PostCardCover
        ratio="3/2"
        className="col-start-1 row-start-1 w-[96px] shrink-0 self-start rounded-sm sm:w-28"
      >
        <CoverImage
          src={imageUrl}
          alt=""
          sizes="(min-width: 640px) 112px, 96px"
          className="object-cover"
        />
      </PostCardCover>
      <div className="col-start-2 row-start-1 flex min-w-0 flex-col gap-2 self-stretch">
        <h3 className="text-[15px] font-semibold leading-snug sm:text-base">
          <Link
            href={postHref}
            className="line-clamp-2 break-words hover:text-primary hover:underline"
          >
            {title}
          </Link>
        </h3>
        <div className="flex min-w-0 items-center justify-between gap-1.5 sm:gap-3">
          <PostAuthorLine
            authorId={authorId}
            authorName={authorName}
            authorUsername={authorUsername}
            authorAvatarUrl={authorAvatarUrl}
            avatarSize="md"
            nameClassName="min-w-0 max-w-[20ch] font-normal text-muted-foreground"
            className="gap-1 text-xs sm:text-sm"
          />
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
      <PostTags
        tags={tags}
        className="col-span-2 row-start-2 hidden items-center gap-1.5 sm:flex"
      />
    </Card>
  );
}
