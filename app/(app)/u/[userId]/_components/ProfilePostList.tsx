/**
 * Client component that renders the paginated list of posts authored by
 * the profile being viewed. Wraps the shared `PostCard` component and
 * provides a "Load More" button once the first page is exhausted.
 *
 * The page (Server Component) already knows the author's `userId` and
 * the rest of the profile metadata — it passes the userId down here.
 * This component is responsible only for the live, paginated query.
 */

"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostCard } from "@/components/web/PostCard";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ProfilePostListProps {
  /** Better Auth user ID of the author whose posts to display. */
  userId: string;
}

export function ProfilePostList({ userId }: ProfilePostListProps) {
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.posts.getPostsByAuthorId,
    { authorId: userId },
    { initialNumItems: 12 },
  );

  if (isLoading && results.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Loading posts...</p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No posts yet.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {results.map((post) => (
          <PostCard
            key={post._id}
            postId={post._id}
            title={post.title}
            body={post.body}
            imageUrl={post.imageUrl}
            commentCount={post.commentCount}
            createdAt={post.createdAt}
            authorId={post.authorId}
            authorName={post.authorName}
            authorAvatarUrl={post.authorAvatarUrl}
          />
        ))}
      </div>

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => loadMore(12)}
            disabled={isLoading}
          >
            {isLoading ? (
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
