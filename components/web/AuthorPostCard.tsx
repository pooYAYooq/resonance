/**
 * One bounded author-work card.
 *
 * The whole card is a single link so it has exactly one accessible name and one
 * keyboard stop: the title. The tile is a 3:2 cover, title, and like count. The
 * featured layout is the same content in a horizontal card for the profile
 * gallery's lead item.
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

export type AuthorCard = {
  postId: string;
  title: string;
  imageUrl: string | null;
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
const FEATURE_IMAGE_SIZES = "(min-width: 1024px) 66vw, 100vw";

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
      className="relative h-full gap-0 overflow-visible rounded-xl p-0 transition-colors hover:bg-muted/30"
    >
      <Link
        href={`/blog/${post.postId}`}
        aria-label={post.title}
        className={cn(
          "group block h-full min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          featured && "sm:grid sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
        <PostCardCover
          testId="author-card-cover"
          ratio="3/2"
          className={cn(
            "rounded-t-xl",
            featured &&
              "sm:aspect-auto sm:h-full sm:min-h-[14rem] sm:rounded-l-xl sm:rounded-tr-none md:min-h-[16rem] lg:min-h-[18rem]",
          )}
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
            "flex flex-col gap-2 p-3.5",
            featured && "justify-center p-5 sm:p-6",
          )}
        >
          <h3
            className={cn(
              "break-words text-[19px] leading-[1.45] font-medium tracking-[-0.035em] md:text-[17px]",
              featured && "text-2xl md:text-3xl",
            )}
          >
            {post.title}
          </h3>
          <span
            aria-label={`${post.likeCount} likes`}
            className={cn(
              "flex items-center gap-[6px] text-[11px] text-muted-foreground",
              featured && "text-sm",
            )}
          >
            <Heart
              aria-hidden="true"
              className={cn("size-[13px]", featured && "size-4")}
            />
            {post.likeCount}
          </span>
        </div>
      </Link>

      {coverFailed ? (
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-t-xl bg-muted px-3 text-center text-xs text-muted-foreground",
            featured &&
              "sm:inset-y-0 sm:right-auto sm:aspect-auto sm:h-full sm:w-[60%] sm:rounded-l-xl sm:rounded-tr-none",
          )}
        >
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
