"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { PostCard } from "@/components/web/PostCard";
import { EmptyState } from "@/components/web/EmptyState";
import { Button } from "@/components/ui/button";
import { Loader2, Bookmark } from "lucide-react";

export function SavedSection() {
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
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (listLoading && results.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!listLoading && results.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved posts"
        description="Bookmark posts to read later and they'll appear here."
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
