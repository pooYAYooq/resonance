"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { Heart, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { PostCard } from "@/components/web/PostCard";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";

export function LikedSection() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
    }
  }, [isLoading, isAuthenticated, router]);

  const {
    results,
    status,
    loadMore,
    isLoading: listLoading,
  } = usePaginatedQuery(
    api.likes.getLikedPosts,
    !isLoading && isAuthenticated ? {} : "skip",
    { initialNumItems: 12 },
  );

  if (isLoading || !isAuthenticated || (listLoading && results.length === 0)) {
    return (
      <div className="flex justify-center py-12">
        <div role="status" aria-label="Loading liked posts">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (results.length === 0 && status === "Exhausted") {
    return (
      <EmptyState
        icon={Heart}
        title="No liked posts"
        description="Like posts that resonate with you and they'll appear here."
        action={
          <Button asChild variant="outline">
            <Link href="/blog">Browse the Blog</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {results.map((post) => (
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

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => loadMore(12)}
            disabled={listLoading}
          >
            {listLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
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
