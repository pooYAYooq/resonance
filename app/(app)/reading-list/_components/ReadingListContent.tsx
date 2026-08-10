/**
 * Client component for the authenticated, paginated reading list.
 *
 * Auth gate mirrors `/create` exactly: `useConvexAuth` → loading
 * spinner, `!isAuthenticated` → `useEffect` redirects to `/auth/login`,
 * and the paginated query is skipped (`"skip"` args) until authenticated
 * so anonymous visitors don't issue an empty round-trip. Then
 * `usePaginatedQuery(api.bookmarks.getBookmarkedPosts)` renders the
 * saved posts in the same responsive grid + "Load more" pattern as
 * `ProfilePostList`. Unbookmarking a card here deletes the bookmark row
 * so the paginated query re-emits and the card drops out (GitHub
 * "Saved"-style removal).
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostCard } from "@/components/web/PostCard";
import { EmptyState } from "@/components/web/EmptyState";
import { Button } from "@/components/ui/button";
import { Loader2, Bookmark } from "lucide-react";

/**
 * Displays the authenticated user's bookmarked posts with pagination.
 *
 * @returns The reading list content, loading state, or empty state.
 */
export function ReadingListContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const queryArgs = isAuthenticated ? {} : "skip";

  const {
    results,
    status,
    loadMore,
    isLoading: listLoading,
  } = usePaginatedQuery(api.bookmarks.getBookmarkedPosts, queryArgs, {
    initialNumItems: 12,
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin size-8 text-muted-foreground" />
      </div>
    );
  }

  if (listLoading && results.length === 0) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin size-8 text-muted-foreground" />
      </div>
    );
  }

  if (!listLoading && results.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved posts"
        description="Bookmark posts to read later and they'll appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((post) => (
          <PostCard
            key={post._id}
            postId={post._id}
            title={post.title}
            body={post.body}
            imageUrl={post.imageUrl}
            commentCount={post.commentCount}
            likeCount={post.likeCount ?? 0}
            isLiked={post.isLiked ?? false}
            createdAt={post.createdAt}
            authorId={post.authorId}
            authorName={post.authorName}
            authorAvatarUrl={post.authorAvatarUrl}
            tags={post.tags}
          />
        ))}
      </div>

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => loadMore(12)}
            disabled={listLoading}
          >
            {listLoading ? (
              <>
                <Loader2 className="animate-spin size-4" />
                <span className="ml-2">Loading more...</span>
              </>
            ) : (
              <span>Load more</span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
