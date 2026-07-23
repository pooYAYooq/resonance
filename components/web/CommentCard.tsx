/**
 * Renders a single comment card with author metadata, a timestamp, and a
 * like button. Used inside the comment list below each blog post.
 */

"use client";

import { UserAvatar } from "./UserAvatar";
import { CommentLikeButton } from "./CommentLikeButton";
import type { Id } from "@/convex/_generated/dataModel";

interface CommentCardProps {
  commentId: Id<"comments">;
  authorName: string;
  body: string;
  createdAt: number;
  authorId: string;
  authorAvatarUrl?: string | null;
  isLiked: boolean;
  likeCount: number;
}

export function CommentCard({
  commentId,
  authorName,
  body,
  createdAt,
  authorId,
  authorAvatarUrl,
  isLiked,
  likeCount,
}: CommentCardProps) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 mb-2">
        <UserAvatar
          userId={authorId}
          name={authorName}
          avatarUrl={authorAvatarUrl}
          className="size-8 shrink-0"
        />
        <span className="font-semibold text-sm">{authorName}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(createdAt).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          at{" "}
          {new Date(createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{body}</p>
      <div className="flex justify-end mt-2">
        <CommentLikeButton
          commentId={commentId}
          isLiked={isLiked}
          likeCount={likeCount}
        />
      </div>
    </div>
  );
}
