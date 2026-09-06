"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { DiscoverResultsSkeleton } from "./DiscoverStates";
import { DiscoverPostSummary } from "./DiscoverPostSummary";
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
              href={buildDiscoverLatestLink()}
              className="text-sm font-medium text-primary hover:underline"
            >
              {mode.mode === "search" ? "Clear search" : "Browse latest"}
            </Link>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        {results.map((post) => (
          <DiscoverPostSummary key={post._id} post={post} />
        ))}
      </div>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => loadMore(12)}
            disabled={status === "LoadingMore"}
          >
            {status === "LoadingMore" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Loading more...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
