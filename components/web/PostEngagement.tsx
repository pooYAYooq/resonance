import { Heart, MessageSquare } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { BookmarkButton } from "./BookmarkButton";
import { LikeButton } from "./LikeButton";

type PostEngagementProps = {
  postId: Id<"posts">;
  postTitle: string;
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  showComments?: boolean;
  showLikeButton?: boolean;
  showLikeCount?: boolean;
  showSave?: boolean;
  savePresentation?: "compact" | "icon";
  className?: string;
};

export function PostEngagement({
  postId,
  postTitle,
  commentCount,
  likeCount,
  isLiked,
  isBookmarked,
  showComments = true,
  showLikeButton = true,
  showLikeCount = true,
  showSave = true,
  savePresentation = "compact",
  className,
}: PostEngagementProps) {
  return (
    <div
      role="group"
      aria-label="Engagement"
      className={cn(
        "flex flex-wrap items-center gap-4 text-xs text-muted-foreground",
        className,
      )}
    >
      {showComments ? (
        <span className="flex items-center gap-1">
          <MessageSquare aria-hidden="true" className="size-3.5" />
          <span aria-hidden="true">{commentCount}</span>
          <span className="sr-only">{commentCount} comments</span>
        </span>
      ) : null}
      {showLikeButton ? (
        <LikeButton
          postId={postId}
          isLiked={isLiked}
          likeCount={likeCount}
          postTitle={postTitle}
        />
      ) : showLikeCount ? (
        <span className="flex items-center gap-1">
          <Heart aria-hidden="true" className="size-3.5" />
          <span aria-hidden="true">{likeCount}</span>
          <span className="sr-only">{likeCount} likes</span>
        </span>
      ) : null}
      {showSave ? (
        <BookmarkButton
          postId={postId}
          isBookmarked={isBookmarked}
          presentation={savePresentation}
          postTitle={postTitle}
        />
      ) : null}
    </div>
  );
}
