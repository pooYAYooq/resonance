/**
 * Client component that renders a paginated comment thread and submission form
 * for a blog post. Uses Convex usePaginatedQuery for "Load More" support.
 * Handles form validation via Zod, Convex mutations, and UI transition states.
 */

"use client";
import { Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CommentComposer } from "./CommentComposer";
import { CommentCard } from "./CommentCard";

import {
  positionNotificationDestination,
  finishMissingNotificationTarget,
} from "@/lib/notification-navigation";

interface CommentSectionProps {
  initialTotalCount: number;
}

/**
 * Renders the comment section for a single post, including the paginated list
 * of existing comments and a form to submit new ones.
 *
 * @param props - `CommentSectionProps`: initial total count for SSR.
 * @returns JSX.Element: a card containing the comment list and reply form.
 */
export function CommentSection({ initialTotalCount }: CommentSectionProps) {
  const params = useParams<{ postId: Id<"posts"> }>();
  const { isLoading: isAuthLoading } = useConvexAuth();
  const postId = params?.postId;
  const queryArgs = isAuthLoading || !postId ? "skip" : { postId };

  // Convex paginated query for comments. Ordered newest-first.
  const {
    results: comments,
    status,
    isLoading,
    loadMore,
  } = usePaginatedQuery(api.comments.getCommentsByPostId, queryArgs, {
    initialNumItems: 20,
  });

  const [targetCommentId, setTargetCommentId] = useState<string | null>(null);
  const [targetCommentLikes, setTargetCommentLikes] = useState(false);
  const landedCommentRef = useRef<string | null>(null);

  useEffect(() => {
    const readCommentAnchor = () => {
      landedCommentRef.current = null;
      const match = /^#comment-([a-z0-9]+)(-likes)?$/.exec(
        window.location.hash,
      );
      const postLikes = window.location.hash === "#post-likes";
      setTargetCommentId(match?.[1] ?? (postLikes ? "post-likes" : null));
      setTargetCommentLikes(Boolean(match?.[2]) || postLikes);
    };
    readCommentAnchor();
    window.addEventListener("hashchange", readCommentAnchor);
    window.addEventListener(
      "notification-destination-ready",
      readCommentAnchor,
    );
    return () => {
      window.removeEventListener("hashchange", readCommentAnchor);
      window.removeEventListener(
        "notification-destination-ready",
        readCommentAnchor,
      );
    };
  }, [postId]);

  useLayoutEffect(() => {
    if (!targetCommentId || !postId) return;
    const destination = `${postId}:${targetCommentId}:${targetCommentLikes}`;
    if (landedCommentRef.current === destination) return;
    if (positionNotificationDestination(new URL(window.location.href))) {
      landedCommentRef.current = destination;
    } else if (!isLoading && !isAuthLoading && status === "CanLoadMore") {
      loadMore(20);
    } else if (!isLoading && !isAuthLoading && status === "Exhausted") {
      finishMissingNotificationTarget();
      landedCommentRef.current = destination;
    }
  }, [
    comments,
    isLoading,
    isAuthLoading,
    loadMore,
    postId,
    status,
    targetCommentId,
    targetCommentLikes,
  ]);

  // Fetch the post client-side so commentCount updates reactively when
  // new comments are added via the mutation above.
  const post = useQuery(api.posts.getPostById, queryArgs);
  const totalCount = post?.commentCount ?? initialTotalCount;

  const canLoadMore = status === "CanLoadMore";
  const isLoadingMore = status === "LoadingMore";

  return (
    <Card id="comments">
      <CardHeader className="flex flex-row items-center gap-2 border-b border-border">
        <MessageSquare className="size-5" />
        <h2 className="text-xl font-bold">
          {comments.length < totalCount
            ? `Showing ${comments.length} of ${totalCount} comments`
            : `${totalCount} ${totalCount === 1 ? "comment" : "comments"}`}
        </h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {isLoading && comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No comments yet. Be the first to reply.
            </p>
          ) : (
            comments.map((comment) => (
              <CommentCard
                key={comment._id}
                commentId={comment._id}
                authorName={comment.authorName}
                authorUsername={comment.authorUsername}
                body={comment.body}
                createdAt={comment.createdAt}
                authorId={comment.authorId}
                authorAvatarUrl={comment.authorAvatarUrl}
                isLiked={comment.isLiked}
                likeCount={comment.likeCount}
              />
            ))
          )}
        </div>

        {canLoadMore && (
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => loadMore(20)}
              disabled={isLoadingMore}
              className="w-full"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="animate-spin size-4" />
                  <span className="ml-2">Loading more...</span>
                </>
              ) : (
                <span>Load more comments</span>
              )}
            </Button>
          </div>
        )}

        <CommentComposer postId={postId} />
      </CardContent>
    </Card>
  );
}
