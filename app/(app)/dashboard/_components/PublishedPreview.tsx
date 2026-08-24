"use client";

import Link from "next/link";
import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";
import { Loader2, Newspaper } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { PostCard } from "@/components/web/PostCard";
import { DASHBOARD_PREVIEW_LIMIT } from "./previewConstants";

export function PublishedPreview() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const { results, isLoading: listLoading } = usePaginatedQuery(
    api.posts.getPostsByAuthorId,
    currentUser?.userId ? { authorId: currentUser.userId } : "skip",
    { initialNumItems: DASHBOARD_PREVIEW_LIMIT },
  );

  if (
    isLoading ||
    !isAuthenticated ||
    !currentUser ||
    (listLoading && results.length === 0)
  ) {
    return (
      <div
        className="flex justify-center py-8"
        role="status"
        aria-label="Loading published posts"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section aria-labelledby="published-preview-title" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="published-preview-title" className="text-xl font-semibold">
          Published Posts
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/published">View published posts</Link>
        </Button>
      </div>
      {results.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No published posts yet"
          description="Publish a draft or start a new post to share your work."
          action={
            <Button asChild variant="outline">
              <Link href="/create">Start a post</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
      )}
    </section>
  );
}
