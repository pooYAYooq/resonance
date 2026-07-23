/**
 * Generic like-toggle button shared by post and comment like buttons.
 *
 * Handles auth gating (redirect to login), an in-flight loading state, an
 * optimistic local state synced from server-rendered props without a
 * useEffect, and Sonner toasts. The wrapper component owns the `useMutation`
 * call (so the mutation arg name — postId vs commentId — stays correct) and
 * passes an already-bound `onToggle` callback.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LikeToggleProps {
  isLiked: boolean;
  count: number;
  onToggle: () => Promise<{ liked: boolean; likeCount: number }>;
  ariaLabelLiked: string;
  ariaLabelNotLiked: string;
  toastLiked: string;
  toastUnliked: string;
  size?: "sm" | "default";
}

export function LikeToggle({
  isLiked,
  count,
  onToggle,
  ariaLabelLiked,
  ariaLabelNotLiked,
  toastLiked,
  toastUnliked,
  size = "sm",
}: LikeToggleProps) {
  const [isPending, startTransition] = useTransition();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  const [localLiked, setLocalLiked] = useState(isLiked);
  const [localCount, setLocalCount] = useState(count);
  const [prevIsLiked, setPrevIsLiked] = useState(isLiked);
  const [prevCount, setPrevCount] = useState(count);

  if (isLiked !== prevIsLiked || count !== prevCount) {
    setPrevIsLiked(isLiked);
    setPrevCount(count);
    setLocalLiked(isLiked);
    setLocalCount(count);
  }

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    startTransition(async () => {
      try {
        const result = await onToggle();
        setLocalLiked(result.liked);
        setLocalCount(result.likeCount);
        toast.success(result.liked ? toastLiked : toastUnliked);
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleClick}
      disabled={isPending || isLoading}
      aria-label={localLiked ? ariaLabelLiked : ariaLabelNotLiked}
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