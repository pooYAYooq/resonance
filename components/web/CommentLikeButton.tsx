/**
 * CommentLikeButton — thin wrapper over the shared LikeToggle primitive for
 * comments. Owns the `useMutation` call so the mutation arg name (`commentId`)
 * stays correct and type-safe. Uses comment-specific labels and toasts.
 */

"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { LikeToggle } from "./LikeToggle";

interface CommentLikeButtonProps {
  commentId: Id<"comments">;
  isLiked: boolean;
  likeCount: number;
}

export function CommentLikeButton({
  commentId,
  isLiked,
  likeCount,
}: CommentLikeButtonProps) {
  const toggleCommentLike = useMutation(api.likes.toggleCommentLike);
  return (
    <LikeToggle
      isLiked={isLiked}
      count={likeCount}
      onToggle={() => toggleCommentLike({ commentId })}
      ariaLabelLiked="Unlike this comment"
      ariaLabelNotLiked="Like this comment"
      toastLiked="Comment liked"
      toastUnliked="Comment unliked"
    />
  );
}
