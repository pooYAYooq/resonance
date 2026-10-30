"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { Loader2, Rss } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { FeedPostCard } from "@/components/web/FeedPostCard";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";

type FeedPost = Doc<"posts"> & {
  imageUrl: string | null;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  isLiked: boolean;
  isBookmarked: boolean;
};

/**
 * Displays the authenticated user's paginated feed and provides controls for loading additional posts.
 */
export function FeedContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [asOf] = useState(() => Date.now());
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<FeedPost[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const paginationFocusRef = useRef<{
    control: HTMLButtonElement;
    itemCount: number;
  } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
    }
  }, [isLoading, isAuthenticated, router]);

  const page = useQuery(
    api.feed.getFeed,
    !isLoading && isAuthenticated
      ? {
          asOf,
          paginationOpts: {
            numItems: 20,
            maximumRowsRead: 20,
            cursor,
          },
        }
      : "skip",
  );

  const currentItemCount = () =>
    rootRef.current?.querySelectorAll('[data-slot="card"]').length ?? 0;

  const requestNextPage = useCallback(() => {
    if (!page || page.isDone) return;
    if (loadMoreRef.current && document.activeElement === loadMoreRef.current) {
      paginationFocusRef.current = {
        control: loadMoreRef.current,
        itemCount: currentItemCount(),
      };
    }
    setPages((current) => [...current, ...page.page]);
    setCursor(page.continueCursor);
  }, [page]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (
      !node ||
      !page ||
      page.isDone ||
      typeof IntersectionObserver === "undefined"
    )
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          requestNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, requestNextPage]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      paginationFocusRef.current = null;
      return;
    }
    const request = paginationFocusRef.current;
    const root = rootRef.current;
    if (!request || !page || !root) return;
    paginationFocusRef.current = null;

    // A retained pagination control owns focus through loading. A final page
    // removes it, in which case Chromium falls back to body. Do not restore
    // when the user has deliberately moved to another control in the meantime.
    if (
      document.activeElement !== request.control &&
      (request.control.isConnected || document.activeElement !== document.body)
    )
      return;

    const cards = Array.from(
      root.querySelectorAll<HTMLElement>('[data-slot="card"]'),
    );
    const firstControl = "a[href], button:not([disabled])";
    const appended =
      cards[request.itemCount]?.querySelector<HTMLElement>(firstControl);
    const recovery = Array.from(
      root.querySelectorAll<HTMLElement>(firstControl),
    ).find((control) => !control.closest('[data-slot="card"]'));
    const surviving = cards.at(-1)?.querySelector<HTMLElement>(firstControl);
    (appended ?? recovery ?? surviving)?.focus();
  });

  if (isLoading || !isAuthenticated || (!page && cursor === null)) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const uniquePosts = Array.from(
    new Map(
      [...pages, ...(page?.page ?? [])].map((post) => [post._id, post]),
    ).values(),
  );

  if (uniquePosts.length === 0 && page?.isDone) {
    return (
      <div ref={rootRef}>
        <EmptyState
          icon={Rss}
          title="Your feed is empty"
          description="Follow authors to see their latest posts here."
          // Feed is retention; Blog is the recovery path for authors/topics.
          action={
            <Button asChild variant="outline">
              <Link href="/blog">Blog</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      {uniquePosts.map((post) => (
        <FeedPostCard
          key={post._id}
          postId={post._id}
          title={post.title}
          imageUrl={post.imageUrl}
          commentCount={post.commentCount}
          likeCount={post.likeCount ?? 0}
          isLiked={post.isLiked}
          isBookmarked={post.isBookmarked}
          publishedAt={post.publishedAt ?? post.createdAt}
          authorId={post.authorId}
          authorName={post.authorName}
          authorUsername={post.authorUsername}
          authorAvatarUrl={post.authorAvatarUrl}
          tags={post.tags}
          now={asOf}
        />
      ))}

      {!page?.isDone && (
        <div className="flex flex-col items-center gap-2">
          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
          <Button
            ref={loadMoreRef}
            variant="outline"
            aria-disabled={!page}
            onFocus={() => {
              if (!loadMoreRef.current) return;
              paginationFocusRef.current = {
                control: loadMoreRef.current,
                itemCount: currentItemCount(),
              };
            }}
            onBlur={(event) => {
              const control = event.currentTarget;
              // Chromium can emit blur while a removed element is still
              // connected. Classify deliberate departures after DOM removal.
              queueMicrotask(() => {
                if (
                  paginationFocusRef.current?.control === control &&
                  control.isConnected &&
                  document.activeElement !== control
                )
                  paginationFocusRef.current = null;
              });
            }}
            onClick={() => {
              if (!page) return;
              requestNextPage();
            }}
          >
            {page ? "Load more" : <span role="status">Loading more...</span>}
          </Button>
        </div>
      )}
    </div>
  );
}
