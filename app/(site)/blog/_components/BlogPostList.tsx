"use client";

import { useEffect, useRef, useState } from "react";
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

function modeKey(mode: DiscoverMode) {
  if (mode.mode === "topic") return `topic:${mode.tag}`;
  if (mode.mode === "search") return `search:${mode.query}`;
  return "latest";
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
  const [announcement, setAnnouncement] = useState("");
  const currentModeKey = modeKey(mode);
  const previousModeRef = useRef(currentModeKey);
  const previousStatusRef = useRef(status);
  const previousCountRef = useRef(results.length);

  // A disconnected Load more control waits for the next page, then focus moves
  // to the first appended card. If the request settles without new cards, the
  // hook falls back to the replacement control or the last visible card.
  useListFocusRestore(rootRef, '[data-slot="card"]', status === "LoadingMore");

  // Announce loading, appended results, and completion. Reset the message when
  // the mode changes so a previous search's count never describes a new list.
  useEffect(() => {
    if (previousModeRef.current !== currentModeKey) {
      previousModeRef.current = currentModeKey;
      previousStatusRef.current = status;
      previousCountRef.current = results.length;
      setAnnouncement("");
      return;
    }

    const previousStatus = previousStatusRef.current;
    const previousCount = previousCountRef.current;
    previousStatusRef.current = status;
    previousCountRef.current = results.length;

    if (status === "LoadingMore") {
      setAnnouncement("Loading more posts.");
      return;
    }
    if (previousStatus !== "LoadingMore") return;

    const added = results.length - previousCount;
    const shown = `${results.length} ${
      results.length === 1 ? "post" : "posts"
    } shown`;
    if (added > 0) {
      const loaded = `Loaded ${added} more ${added === 1 ? "post" : "posts"}`;
      setAnnouncement(
        status === "Exhausted"
          ? `${loaded}. ${shown}. All posts loaded.`
          : `${loaded}. ${shown}.`,
      );
    } else if (status === "Exhausted") {
      setAnnouncement(`${shown}. All posts loaded.`);
    } else {
      // A page can settle without a visible increase when hydration filters
      // out missing records. Do not leave the live region saying "loading".
      setAnnouncement("No new posts loaded.");
    }
  }, [currentModeKey, results.length, status]);

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
    <div
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label="Blog posts"
      className="flex flex-col gap-6 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <div className="flex flex-col gap-6">
        {results.map((post, index) => (
          <BlogPostCard key={post._id} post={post} priority={index === 0} />
        ))}
      </div>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <div className="flex justify-center">
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
        </div>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
