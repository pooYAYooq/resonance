/**
 * BookmarkButton — self-contained save/unsave button for posts.
 *
 * Mirrors `FollowButton`'s structure (the FollowButton precedent, per
 * the 1.5 spec): a self-subscribing client component that owns its
 * `useMutation` and `useQuery` for the bookmark toggle. Correct
 * authenticated initial state on every surface — vital for bookmarks
 * because server-side `fetchQuery` runs unauthenticated in this repo
 * (see the 1.5 spec's "Discovered limitation").
 *
 * Auth gate: anonymous click redirects to /auth/login. Uses the
 * render-time `prev`-state reconciler (no `useEffect`) shared with
 * `LikeToggle` and `FollowButton`.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  /** Convex document ID of the post to bookmark/unbookmark. */
  postId: Id<"posts">;
  /** Button size; mirrors the adjacent `LikeButton` default of `"sm"`. */
  size?: "sm" | "default";
}

export function BookmarkButton({
  postId,
  size = "sm",
}: BookmarkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  const isBookmarkedQuery = useQuery(api.bookmarks.isBookmarked, { postId });
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);

  const [localSaved, setLocalSaved] = useState(false);
  const [prevIsBookmarked, setPrevIsBookmarked] = useState<boolean | undefined>(
    undefined,
  );

  if (isBookmarkedQuery !== prevIsBookmarked) {
    setPrevIsBookmarked(isBookmarkedQuery);
    setLocalSaved(isBookmarkedQuery ?? false);
  }

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    startTransition(async () => {
      try {
        const result = await toggleBookmark({ postId });
        setLocalSaved(result.bookmarked);
        toast.success(
          result.bookmarked
            ? "Saved to reading list"
            : "Removed from reading list",
        );
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
      aria-label={
        localSaved ? "Remove from reading list" : "Save to reading list"
      }
      aria-pressed={localSaved}
    >
      {isPending ? (
        <Loader2 className="animate-spin size-4" />
      ) : (
        <Bookmark
          className={cn("size-4", localSaved && "text-primary")}
          fill={localSaved ? "currentColor" : "none"}
        />
      )}
    </Button>
  );
}
