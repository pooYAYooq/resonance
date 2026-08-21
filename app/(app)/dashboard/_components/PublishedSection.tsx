"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { Loader2, Newspaper } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { PostCard } from "@/components/web/PostCard";

export function PublishedSection() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const authorId = currentUser?.userId;
  const { results, status, loadMore, isLoading: listLoading } =
    usePaginatedQuery(
      api.posts.getPostsByAuthorId,
      authorId ? { authorId } : "skip",
      { initialNumItems: 12 },
    );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (
    isLoading ||
    !isAuthenticated ||
    !currentUser ||
    (listLoading && results.length === 0)
  ) {
    return (
      <div
        className="flex justify-center py-12"
        role="status"
        aria-label="Loading published posts"
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="No published posts yet"
        description="Publish a draft or start a new post to share your work."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/create">New Post</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/drafts">View Drafts</Link>
            </Button>
          </div>
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
            {listLoading ? "Loading more..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
