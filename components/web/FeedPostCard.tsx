"use client";

import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { extractPlainText, parsePostBody } from "@/lib/post-content";
import { cn } from "@/lib/utils";
import { CoverImage } from "./CoverImage";
import { PostAuthorLine } from "./PostAuthorLine";
import { PostCardCover } from "./PostCardCover";
import { PostEngagement } from "./PostEngagement";
import { PostTags } from "./PostTags";

type FeedPostCardProps = {
  postId: Id<"posts">;
  title: string;
  body: string;
  imageUrl?: string | null;
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  publishedAt: number;
  authorId: string;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl?: string | null;
  tags?: string[];
  now: number;
};

function titleClasses(title: string) {
  return title.trim().length > 50 ? "text-base" : "text-lg";
}

export function FeedPostCard({
  postId,
  title,
  body,
  imageUrl,
  commentCount,
  likeCount,
  isLiked,
  isBookmarked,
  publishedAt,
  authorId,
  authorName,
  authorUsername,
  authorAvatarUrl,
  tags,
  now,
}: FeedPostCardProps) {
  const parsedBody = parsePostBody(body);
  const excerpt =
    parsedBody.kind === "structured"
      ? extractPlainText(parsedBody.document.blocks)
      : "";
  const postHref = `/blog/${postId}`;

  return (
    <Card
      className={cn(
        "h-full gap-0 overflow-hidden rounded-sm p-0 transition-colors motion-safe:transition-all motion-safe:hover:-translate-y-0.5 hover:bg-muted/30",
        "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
      )}
    >
      <PostCardCover
        testId="post-card-cover"
        ratio="3/2"
        className="rounded-t-sm md:rounded-l-sm md:rounded-tr-none"
      >
        <CoverImage
          src={imageUrl}
          alt={title}
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover"
        />
      </PostCardCover>
      <div className="flex flex-col gap-3 p-4">
        <PostAuthorLine
          authorId={authorId}
          authorName={authorName}
          authorUsername={authorUsername}
          authorAvatarUrl={authorAvatarUrl}
          date={publishedAt}
          dateMode="relative"
          now={now}
        />
        <Link href={postHref}>
          <h2
            className={cn(
              "line-clamp-2 break-words font-semibold tracking-[-0.02em] hover:text-primary",
              titleClasses(title),
            )}
          >
            {title}
          </h2>
        </Link>
        {excerpt ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {excerpt}
          </p>
        ) : null}
        <PostTags tags={tags ?? []} />
        <div className="mt-auto flex items-center justify-between gap-3">
          <PostEngagement
            postId={postId}
            postTitle={title}
            commentCount={commentCount}
            likeCount={likeCount}
            isLiked={isLiked}
            isBookmarked={isBookmarked}
          />
          <Link
            href={postHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
            )}
          >
            Read
          </Link>
        </div>
      </div>
    </Card>
  );
}
