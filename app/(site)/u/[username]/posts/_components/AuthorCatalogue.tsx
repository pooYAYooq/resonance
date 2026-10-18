/**
 * The public author post catalogue.
 *
 * One reactive paginated stream over the viewer-independent
 * `profiles.listAuthorPosts` (newest first). The native pages are rendered
 * directly rather than copied into a second append-only list, so a live
 * deletion shrinks the grid without leaving a ghost card behind, and an author
 * change resets the subscription instead of blending two catalogues.
 *
 * `AuthorCatalogue` is the boundary owner: the hook and its page render live in
 * the inner list, one level below `CatalogueQueryBoundary`, so a query failure
 * is caught by the boundary and recovered with a Retry that remounts the
 * subscription. The boundary is keyed by author, so a failure for one author
 * cannot outlive the switch to another: the new author mounts a fresh
 * subscription instead of inheriting the recovery panel. The server-rendered
 * author header sits above all of it and is never affected.
 */

"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import { ArrowLeft, Loader2, NotebookPen } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { AuthorPostCard } from "@/components/web/AuthorPostCard";
import { EmptyState } from "@/components/web/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { useListFocusRestore } from "@/lib/use-list-focus-restore";
import { buildProfilePath } from "@/lib/username";
import { CatalogueQueryBoundary } from "./CatalogueQueryBoundary";

/** Native page size, within the server-validated 1..20 bound. */
const PAGE_SIZE = 12;

export interface AuthorCatalogueProps {
  /** Better Auth user ID of the author whose posts are catalogued. */
  userId: string;
  /** Live canonical username, or null when none is claimed. */
  username: string | null;
}

export function AuthorCatalogue({ userId, username }: AuthorCatalogueProps) {
  return (
    // Keyed by author: a boundary that failed for one author must not survive
    // the switch to another, or the next author's query would never mount.
    <CatalogueQueryBoundary key={userId}>
      <AuthorPostList userId={userId} username={username} />
    </CatalogueQueryBoundary>
  );
}

function AuthorPostList({ userId, username }: AuthorCatalogueProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.profiles.listAuthorPosts,
    { userId },
    { initialNumItems: PAGE_SIZE },
  );

  const rootRef = useRef<HTMLDivElement>(null);
  // Cards are the removable items; the only in-flight request is a page load,
  // so a disconnected Load more control waits for the arriving page.
  useListFocusRestore(rootRef, "li", status === "LoadingMore");

  // Derived from the current status only, so a live deletion can never leave a
  // stale announcement on screen.
  const statusMessage =
    status === "LoadingFirstPage"
      ? "Loading posts."
      : status === "LoadingMore"
        ? "Loading more posts."
        : "";

  const isEmpty = results.length === 0;
  // The root is the focus-restore fallback when nothing focusable is left, so
  // it always carries a name. An empty catalogue names itself after the empty
  // state it shows, which keeps the final-card deletion (where there may be no
  // return link at all) landing on a named context rather than a bare box.
  const contextLabel = isEmpty
    ? status === "LoadingFirstPage"
      ? "Loading posts"
      : "No posts yet"
    : "Published posts";

  return (
    <div
      ref={rootRef}
      data-testid="author-catalogue"
      tabIndex={-1}
      role="region"
      aria-label={contextLabel}
      className="px-[25px] focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring md:px-[42px]"
    >
      {status === "LoadingFirstPage" ? (
        <div className="flex justify-center py-12">
          <Loader2
            aria-hidden="true"
            className="size-8 animate-spin text-muted-foreground"
          />
        </div>
      ) : null}

      {isEmpty ? null : (
        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((post) => (
            <li key={post.postId} className="min-w-0">
              <AuthorPostCard post={post} />
            </li>
          ))}
        </ol>
      )}

      {status === "Exhausted" && isEmpty ? (
        <EmptyState
          icon={NotebookPen}
          title="No posts yet"
          description="There are no published posts from this author yet."
          action={
            username === null ? null : (
              <Link
                href={buildProfilePath(username)}
                className={buttonVariants({ variant: "outline" })}
              >
                <ArrowLeft aria-hidden="true" />
                Back to profile
              </Link>
            )
          }
        />
      ) : null}

      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <div className="mt-[30px] text-center">
          <Button
            type="button"
            variant="outline"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(PAGE_SIZE)}
          >
            {status === "LoadingMore" ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : null}

      {/*
        Persistent polite status, mounted even while the catalogue is empty so
        a live deletion clears the announcement instead of stranding a stale
        "loading more" message.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>
    </div>
  );
}
