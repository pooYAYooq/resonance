/**
 * One bounded author-work card.
 *
 * The whole card is a single link so it has exactly one accessible name and one
 * keyboard stop: the title. The tile is a 3:2 cover, title, and like count. The
 * featured layout is the same content in a larger tile with a 3:2 cover on top
 * for the profile gallery's lead item.
 *
 * A cover that fails to load must stay recoverable without breaking the card,
 * so the error surface is a sibling of the link (never a nested button), stays
 * over the cover, and offers a Retry that remounts the image. The error is
 * keyed by URL, so a replaced image clears a previous failure on its own.
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PostCardCover } from "./PostCardCover";
import { TagLabel } from "./TagPill";

export type AuthorCard = {
  postId: string;
  title: string;
  imageUrl: string | null;
  publishedAt: number;
  tags: string[];
  likeCount: number;
};

/**
 * The showcase grid is `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, so tiles
 * are full width below 768px, half the viewport from 768px, and a third from
 * 1024px. The catalogue has a different column schedule and passes its own
 * `sizes`. The featured card spans two columns at `lg`, so it needs a wider
 * hint.
 */
const SHOWCASE_IMAGE_SIZES =
  "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw";
const FEATURE_IMAGE_SIZES =
  "(min-width: 1024px) 66vw, (min-width: 768px) 50vw, 100vw";

const FEATURE_DATE = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const TILE_DATE = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function titleClasses(title: string, featured: boolean) {
  const length = title.trim().length;
  if (featured) {
    if (length > 45) {
      if (length > 90) return "text-[15px] lg:text-lg xl:text-xl";
      if (length > 60) return "text-[15px] lg:text-xl xl:text-2xl";
      return "text-[15px] lg:text-2xl xl:text-3xl";
    }
    return "text-[17px] lg:text-2xl xl:text-3xl";
  }
  if (length > 45) return "text-[15px]";
  return "text-[17px]";
}

export function AuthorPostCard({
  post,
  sizes,
  featured = false,
}: {
  post: AuthorCard;
  sizes?: string;
  featured?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const coverFailed = post.imageUrl !== null && failedUrl === post.imageUrl;
  const imageSizes =
    sizes ?? (featured ? FEATURE_IMAGE_SIZES : SHOWCASE_IMAGE_SIZES);

  return (
    <Card
      data-featured={featured ? "true" : undefined}
      className="relative h-full gap-0 overflow-visible rounded-md p-0 transition-colors hover:bg-muted/30"
    >
      <Link
        href={`/blog/${post.postId}`}
        aria-label={post.title}
        className="group flex h-full min-w-0 flex-col rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <PostCardCover
          testId="author-card-cover"
          ratio="3/2"
          className="rounded-t-md"
        >
          {post.imageUrl ? (
            <Image
              key={`${post.imageUrl}:${retryKey}`}
              src={post.imageUrl}
              alt=""
              fill
              sizes={imageSizes}
              className="object-cover transition-transform duration-[350ms] motion-safe:group-hover:scale-[1.035]"
              onError={() => setFailedUrl(post.imageUrl)}
            />
          ) : (
            <div aria-hidden="true" className="absolute inset-0" />
          )}
        </PostCardCover>

        <div
          className={cn(
            "flex flex-1 flex-col gap-2 p-3.5",
            featured && "lg:justify-center lg:gap-3 lg:p-5 xl:p-6",
          )}
        >
          <h3
            className={cn(
              "line-clamp-2 break-words leading-[1.45] font-medium tracking-[-0.035em]",
              titleClasses(post.title, featured),
            )}
          >
            {post.title}
          </h3>
          {featured ? (
            <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground lg:flex">
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {FEATURE_DATE.format(post.publishedAt)}
              </time>
              <span
                aria-label={`${post.likeCount} likes`}
                className="flex items-center gap-[6px]"
              >
                <Heart aria-hidden="true" className="size-4" />
                {post.likeCount}
              </span>
            </div>
          ) : null}
          {featured && post.tags.length > 0 ? (
            <div className="hidden flex-wrap gap-2 lg:flex">
              {post.tags.map((tag) => (
                <TagLabel key={tag} tag={tag} />
              ))}
            </div>
          ) : null}
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground",
              featured && "lg:hidden",
            )}
          >
            <time dateTime={new Date(post.publishedAt).toISOString()}>
              {TILE_DATE.format(post.publishedAt)}
            </time>
            <span
              aria-label={`${post.likeCount} likes`}
              className="flex items-center gap-[6px]"
            >
              <Heart aria-hidden="true" className="size-[13px]" />
              {post.likeCount}
            </span>
          </div>
        </div>
      </Link>

      {coverFailed ? (
        <div className="absolute inset-x-0 top-0 flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-t-md bg-muted px-3 text-center text-xs text-muted-foreground">
          <span>Cover unavailable</span>
          <button
            type="button"
            onClick={() => {
              setFailedUrl(null);
              setRetryKey((key) => key + 1);
            }}
            aria-label={`Retry cover for ${post.title}`}
            className="cursor-pointer rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
          >
            Retry
          </button>
        </div>
      ) : null}
    </Card>
  );
}
