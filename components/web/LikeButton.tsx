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
  presentation?: "compact" | "reader" | "collection" | "icon";
  postTitle?: string;
}

export function LikeButton({
  postId,
  isLiked,
  likeCount,
  presentation,
  postTitle,
}: LikeButtonProps) {
  const toggleLike = useMutation(api.likes.toggleLike);
  return (
    <LikeToggle
      presentation={presentation}
      isLiked={isLiked}
      count={likeCount}
      onToggle={() => toggleLike({ postId })}
      ariaLabelLiked={postTitle ? `Unlike “${postTitle}”` : "Unlike this post"}
      ariaLabelNotLiked={postTitle ? `Like “${postTitle}”` : "Like this post"}
      toastLiked="Post liked"
      toastUnliked="Post unliked"
    />
  );
}
