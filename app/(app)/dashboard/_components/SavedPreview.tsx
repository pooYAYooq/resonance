"use client";

import Link from "next/link";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { Bookmark, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { PostCard } from "@/components/web/PostCard";
import { DASHBOARD_PREVIEW_LIMIT } from "./previewConstants";

export function SavedPreview() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { results, isLoading: listLoading } = usePaginatedQuery(
    api.bookmarks.getBookmarkedPosts,
    isAuthenticated ? {} : "skip",
    { initialNumItems: DASHBOARD_PREVIEW_LIMIT },
  );

  if (isLoading || !isAuthenticated || (listLoading && results.length === 0)) {
    return (
      <div
        className="flex justify-center py-8"
        role="status"
        aria-label="Loading saved posts"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section aria-labelledby="saved-preview-title" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="saved-preview-title" className="text-xl font-semibold">
          Saved Posts
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/saved">View saved posts</Link>
        </Button>
      </div>
      {results.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved posts yet"
          description="Bookmark posts to read later and they'll appear here."
          action={
            <Button asChild variant="outline">
              <Link href="/blog">Browse the Blog</Link>
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
              isBookmarked={true}
              createdAt={post.createdAt}
              authorId={post.authorId}
              authorName={post.authorName}
              authorAvatarUrl={post.authorAvatarUrl}
              tags={post.tags}
            />
          ))}
        </div>
      )}
    </section>
  );
}
