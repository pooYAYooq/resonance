"use client";

import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Loader2, Newspaper } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { PostCard } from "@/components/web/PostCard";

export function PublishedSection() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const authorId = currentUser?.userId;
  const {
    results,
    status,
    loadMore,
    isLoading: listLoading,
  } = usePaginatedQuery(
    api.posts.getPostsByAuthorId,
    authorId ? { authorId } : "skip",
    { initialNumItems: 12 },
  );

  if (!currentUser || (listLoading && results.length === 0)) {
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
            isBookmarked={post.isBookmarked}
            createdAt={post.createdAt}
            authorId={post.authorId}
            authorName={post.authorName}
            authorAvatarUrl={post.authorAvatarUrl}
            tags={post.tags}
            authorActions={
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/create?editPostId=${post._id}`}>Edit</Link>
                </Button>
                <Link
                  href={`/blog/${post._id}`}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  View Post
                </Link>
              </div>
            }
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
