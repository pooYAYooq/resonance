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
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";

function formatReaderLikeCount(count: number): string {
  for (const [threshold, suffix] of [
    [1_000_000_000_000, "t"],
    [1_000_000_000, "b"],
    [1_000_000, "m"],
    [1_000, "k"],
  ] as const) {
    if (count >= threshold) return `${Math.floor(count / threshold)}${suffix}`;
  }
  return String(count);
}

interface LikeToggleProps {
  isLiked: boolean;
  count: number;
  onToggle: () => Promise<{ liked: boolean; likeCount: number }>;
  ariaLabelLiked: string;
  ariaLabelNotLiked: string;
  toastLiked: string;
  toastUnliked: string;
  size?: "sm" | "default";
  presentation?: "compact" | "reader";
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
  presentation = "compact",
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
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
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
      variant={presentation === "reader" ? "outline" : "ghost"}
      size={presentation === "reader" ? "lg" : size}
      onClick={handleClick}
      disabled={isPending || isLoading}
      aria-label={
        presentation === "reader"
          ? `${localLiked ? ariaLabelLiked : ariaLabelNotLiked}, ${localCount.toLocaleString("en-US")} ${localCount === 1 ? "like" : "likes"}`
          : localLiked
            ? ariaLabelLiked
            : ariaLabelNotLiked
      }
      aria-pressed={localLiked}
    >
      {isPending ? (
        <Loader2
          data-icon={presentation === "reader" ? "inline-start" : undefined}
          className="animate-spin"
        />
      ) : (
        <Heart
          data-icon={presentation === "reader" ? "inline-start" : undefined}
          className={cn(
            localLiked &&
              (presentation === "reader" ? "text-destructive" : "text-red-500"),
          )}
          fill={localLiked ? "currentColor" : "none"}
        />
      )}
      {presentation === "reader" && (
        <span aria-hidden="true" className="inline-grid text-left">
          <span className="invisible col-start-1 row-start-1">Liked</span>
          <span className="col-start-1 row-start-1">
            {localLiked ? "Liked" : "Like"}
          </span>
        </span>
      )}
      <span
        aria-hidden={presentation === "reader" ? true : undefined}
        className={cn("tabular-nums", presentation === "compact" && "ml-1")}
      >
        {presentation === "reader"
          ? formatReaderLikeCount(localCount)
          : localCount}
      </span>
    </Button>
  );
}
