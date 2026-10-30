"use client";

import { useRef } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { useListFocusRestore } from "@/lib/use-list-focus-restore";
import { DiscoverResultsSkeleton } from "./DiscoverStates";
import { BlogPostCard } from "./BlogPostCard";
import { Loader2, SearchX } from "lucide-react";
import Link from "next/link";
import { buildDiscoverLatestLink, type DiscoverMode } from "@/lib/discover";

interface BlogPostListProps {
  mode: DiscoverMode;
}

// Results own one reactive paginated stream for each mode and expose continuation explicitly.
export function BlogPostList({ mode }: BlogPostListProps) {
  const queryArgs =
    mode.mode === "topic"
      ? { tag: mode.tag }
      : {
          mode: mode.mode,
          ...(mode.mode === "search" ? { query: mode.query } : {}),
        };
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    mode.mode === "topic"
      ? api.discover.getTopicPosts
      : api.discover.getDiscoverPosts,
    queryArgs,
    { initialNumItems: 12 },
  );

  const rootRef = useRef<HTMLDivElement>(null);

  // A disconnected Load more control waits for the next page, then focus moves
  // to the first appended card. If the request settles without new cards, the
  // hook falls back to the replacement control or the last visible card.
  useListFocusRestore(rootRef, '[data-slot="card"]', status === "LoadingMore");

  if (isLoading && results.length === 0) return <DiscoverResultsSkeleton />;

  if (results.length === 0 && status === "Exhausted") {
    const description =
      mode.mode === "search"
        ? `No results for “${mode.query}”.`
        : mode.mode === "topic"
          ? `No posts found for ${mode.tag}.`
          : "No published content is available yet.";
    return (
      <EmptyState
        icon={SearchX}
        title={
          mode.mode === "search"
            ? "No search results"
            : mode.mode === "topic"
              ? "No topic results"
              : "Nothing published yet"
        }
        description={description}
        action={
          mode.mode === "latest" ? null : (
            <Link
              href={`${buildDiscoverLatestLink()}#blog-results`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {mode.mode === "search" ? "Clear search" : "Browse all posts"}
            </Link>
          )
        }
      />
    );
  }

  const postWord = results.length === 1 ? "post" : "posts";
  const statusMessage =
    status === "LoadingMore"
      ? "Loading more posts."
      : status === "Exhausted"
        ? `Showing all ${results.length} ${postWord}.`
        : `Showing ${results.length} ${postWord}.`;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label="Blog posts"
      className="flex flex-col gap-6 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <div
        data-testid="blog-post-list"
        className="flex flex-col gap-6 max-md:gap-2 max-md:divide-y max-md:divide-foreground/20"
      >
        {results.map((post, index) => (
          <BlogPostCard key={post._id} post={post} priority={index === 0} />
        ))}
      </div>
      {/* Reserve the control slot even when the final page removes the button,
          so the footer does not jump and the last card keeps its gap. */}
      <div
        data-testid="blog-load-more-slot"
        className="flex min-h-16 items-center justify-center"
      >
        {status === "CanLoadMore" || status === "LoadingMore" ? (
          <Button
            variant="outline"
            onClick={() => {
              if (status === "LoadingMore") return;
              loadMore(12);
            }}
            aria-disabled={status === "LoadingMore"}
          >
            {status === "LoadingMore" ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Loading more...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>
    </div>
  );
}
