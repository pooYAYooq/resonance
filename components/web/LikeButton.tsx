/**
 * LikeButton — thin wrapper over the shared LikeToggle primitive for posts.
 *
 * Keeps the existing props (`postId`, `isLiked`, `likeCount`) so consumers
 * (PostCard, post detail page) need no changes. Owns the `useMutation` call so
 * the mutation arg name (`postId`) stays correct and type-safe.
 */

"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { LikeToggle } from "./LikeToggle";

interface LikeButtonProps {
  postId: Id<"posts">;
  isLiked: boolean;
  likeCount: number;
}

export function LikeButton({ postId, isLiked, likeCount }: LikeButtonProps) {
  const toggleLike = useMutation(api.likes.toggleLike);
  return (
    <LikeToggle
      isLiked={isLiked}
      count={likeCount}
      onToggle={() => toggleLike({ postId })}
      ariaLabelLiked="Unlike this post"
      ariaLabelNotLiked="Like this post"
      toastLiked="Post liked"
      toastUnliked="Post unliked"
    />
  );
}