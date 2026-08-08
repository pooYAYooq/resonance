"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { Loader2, Rss } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { PostCard } from "@/components/web/PostCard";

type FeedPost = Doc<"posts"> & {
  imageUrl: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  isLiked: boolean;
};

export function FeedContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [asOf] = useState(() => Date.now());
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<FeedPost[]>([]);
  const processedPageKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const page = useQuery(
    api.feed.getFeed,
    isAuthenticated
      ? {
          asOf,
          paginationOpts: {
            numItems: 20,
            maximumRowsRead: 20,
            cursor,
          },
        }
      : "skip",
  );

  const pageKey = page
    ? `${cursor ?? "initial"}:${page.continueCursor}:${page.page
        .map((post) => post._id)
        .join(",")}`
    : null;

  useEffect(() => {
    if (!page || !pageKey || processedPageKey.current === pageKey) {
      return;
    }
    processedPageKey.current = pageKey;
    setPages((current) => (cursor === null ? page.page : [...current, ...page.page]));
  }, [page, pageKey, cursor]);

  if (isLoading || !isAuthenticated || !page) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const uniquePosts = Array.from(
    new Map(pages.map((post) => [post._id, post])).values(),
  );

  if (uniquePosts.length === 0 && page.isDone) {
    return (
      <EmptyState
        icon={Rss}
        title="Your feed is empty"
        description="Follow authors to see their latest posts here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {uniquePosts.map((post) => (
          <PostCard
            key={post._id}
            postId={post._id}
            title={post.title}
            body={post.body}
            imageUrl={post.imageUrl}
            commentCount={post.commentCount}
            likeCount={post.likeCount ?? 0}
            isLiked={post.isLiked}
            createdAt={post.createdAt}
            authorId={post.authorId}
            authorName={post.authorName}
            authorAvatarUrl={post.authorAvatarUrl}
          />
        ))}
      </div>

      {!page.isDone && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setCursor(page.continueCursor)}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
