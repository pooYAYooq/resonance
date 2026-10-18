/**
 * One bounded author-work card.
 *
 * The whole card is a single link so it has exactly one accessible name and one
 * keyboard stop: the title. Below the 3:2 cover sit the title and like count.
 *
 * A cover that fails to load must stay recoverable without breaking the card,
 * so the error surface is a sibling of the link (never a nested button), keeps
 * the frame's 3:2 ratio, and offers a Retry that remounts the image. The error
 * is keyed by URL, so a replaced image clears a previous failure on its own.
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";

export type AuthorCard = {
  postId: string;
  title: string;
  imageUrl: string | null;
  likeCount: number;
};

/**
 * The showcase grid is `grid-cols-1 md:grid-cols-3`, so cards are full width
 * below 768px and a third of the viewport above it. The catalogue has a
 * different column schedule and passes its own `sizes`.
 */
const SHOWCASE_IMAGE_SIZES = "(min-width: 768px) 33vw, 100vw";

export function AuthorPostCard({
  post,
  sizes = SHOWCASE_IMAGE_SIZES,
}: {
  post: AuthorCard;
  sizes?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const coverFailed = post.imageUrl !== null && failedUrl === post.imageUrl;

  return (
    <div className="relative min-w-0">
      <Link
        href={`/blog/${post.postId}`}
        aria-label={post.title}
        className="group block min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <div
          data-testid="author-card-cover"
          className="relative aspect-[3/2] overflow-hidden rounded-xl bg-muted"
        >
          {post.imageUrl ? (
            <Image
              key={`${post.imageUrl}:${retryKey}`}
              src={post.imageUrl}
              alt=""
              fill
              sizes={sizes}
              className="object-cover transition-transform duration-[350ms] group-hover:scale-[1.035]"
              onError={() => setFailedUrl(post.imageUrl)}
            />
          ) : (
            // A published post can have no cover. Keep the frame and title
            // rather than substituting a stock image.
            <div aria-hidden="true" className="absolute inset-0" />
          )}
        </div>
        <h3 className="mt-[14px] mb-[10px] break-words text-[19px] leading-[1.45] font-medium tracking-[-0.035em] md:text-[17px]">
          {post.title}
        </h3>
        <span
          aria-label={`${post.likeCount} likes`}
          className="flex items-center gap-[6px] text-[11px] text-muted-foreground"
        >
          <Heart aria-hidden="true" className="size-[13px]" />
          {post.likeCount}
        </span>
      </Link>

      {coverFailed ? (
        <div className="absolute inset-x-0 top-0 flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-xl bg-muted px-3 text-center text-xs text-muted-foreground">
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
    </div>
  );
}
