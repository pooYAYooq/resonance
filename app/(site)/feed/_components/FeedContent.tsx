"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { Loader2, Rss } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { PostCard } from "@/components/web/PostCard";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";

type FeedPost = Doc<"posts"> & {
  imageUrl: string | null;
  authorName: string | null;
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
          // Feed is retention; Discover is the recovery path for authors/topics.
          action={
            <Button asChild variant="outline">
              <Link href="/blog">Discover</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {uniquePosts.map((post) => (
          <PostCard
            key={post._id}
            postId={post._id}
            title={post.title}
            body={post.body}
            imageUrl={post.imageUrl}
            commentCount={post.commentCount}
            likeCount={post.likeCount ?? 0}
            isLiked={post.isLiked}
            isBookmarked={post.isBookmarked}
            createdAt={post.createdAt}
            authorId={post.authorId}
            authorName={post.authorName}
            authorAvatarUrl={post.authorAvatarUrl}
            tags={post.tags}
          />
        ))}
      </div>

      {!page?.isDone && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            aria-disabled={!page}
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
            onClick={(event) => {
              if (!page) return;
              paginationFocusRef.current =
                document.activeElement === event.currentTarget
                  ? {
                      control: event.currentTarget,
                      itemCount: uniquePosts.length,
                    }
                  : null;
              setPages((current) => [...current, ...page.page]);
              setCursor(page.continueCursor);
            }}
          >
            {page ? "Load more" : <span role="status">Loading more...</span>}
          </Button>
        </div>
      )}
    </div>
  );
}
