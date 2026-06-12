/**
 * LikeButton component for toggling likes on a post.
 *
 * Shows a heart icon with a like count. Handles auth gating by redirecting
 * unauthenticated users to the login page. Uses a transition for loading state.
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  postId: Id<"posts">;
  isLiked: boolean;
  likeCount: number;
}

/**
 * Client-side like toggle button.
 *
 * Redirects unauthenticated users to login. For authenticated users, calls the
 * `toggleLike` mutation inside a transition and shows a toast on success/error.
 */
export function LikeButton({ postId, isLiked, likeCount }: LikeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const toggleLike = useMutation(api.likes.toggleLike);

  const [localLiked, setLocalLiked] = useState(isLiked);
  const [localCount, setLocalCount] = useState(likeCount);

  useEffect(() => {
    setLocalLiked(isLiked);
    setLocalCount(likeCount);
  }, [isLiked, likeCount]);

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    startTransition(async () => {
      try {
        const result = await toggleLike({ postId });
        setLocalLiked(result.liked);
        setLocalCount(result.likeCount);
        toast.success(result.liked ? "Post liked" : "Post unliked");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending || isLoading}
      aria-label={localLiked ? "Unlike this post" : "Like this post"}
      aria-pressed={localLiked}
    >
      {isPending ? (
        <Loader2 className="animate-spin size-4" />
      ) : (
        <Heart
          className={cn("size-4", localLiked && "text-red-500")}
          fill={localLiked ? "currentColor" : "none"}
        />
      )}
      <span className="ml-1">{localCount}</span>
    </Button>
  );
}
