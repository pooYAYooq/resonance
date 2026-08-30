/**
 * FollowButton — self-contained follow/unfollow button for the
 * profile `rightAction` slot.
 *
 * Mirrors `LikeToggle`'s behavior: auth-gated redirect on click,
 * optimistic local label state synced from the `isFollowing` query
 * via a `prevIsFollowing` reconciler (no `useEffect`), Sonner toast
 * on success. Owns its own `useMutation(api.follows.toggleFollow)`.
 *
 * Count display is intentionally NOT here — the displayed counts
 * live in `ProfileStats`, which subscribes to `getFollowCounts` so
 * the bump is authoritative and drift-free.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";

interface FollowButtonProps {
  /** Better Auth user ID of the author to follow/unfollow. */
  profileUserId: string;
  /** Display name of the author, used in toast messages. */
  authorName: string;
  /** Server-derived follow state used before the live query resolves. */
  isFollowing: boolean;
}

export function FollowButton({
  profileUserId,
  authorName,
  isFollowing,
}: FollowButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  const isFollowingQuery = useQuery(
    api.follows.isFollowing,
    !isLoading && isAuthenticated ? { followingId: profileUserId } : "skip",
  );
  const toggleFollow = useMutation(api.follows.toggleFollow);

  // Reconciler: when the query re-emits, sync local state forward.
  // Same pattern as `LikeToggle`'s `prevIsLiked` block.
  const [localFollowing, setLocalFollowing] = useState(isFollowing);
  const [prevIsFollowing, setPrevIsFollowing] = useState<boolean | undefined>(
    undefined,
  );

  if (isFollowingQuery !== prevIsFollowing) {
    setPrevIsFollowing(isFollowingQuery);
    setLocalFollowing(isFollowingQuery ?? isFollowing);
  }

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
      return;
    }

    startTransition(async () => {
      try {
        const result = await toggleFollow({ followingId: profileUserId });
        setLocalFollowing(result.following);
        toast.success(
          result.following
            ? `Followed ${authorName}`
            : `Unfollowed ${authorName}`,
        );
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  const label = localFollowing ? "Following" : "Follow";

  return (
    <Button
      variant={localFollowing ? "default" : "outline"}
      size="default"
      onClick={handleClick}
      disabled={isPending || isLoading}
      aria-label={
        localFollowing ? `Unfollow ${authorName}` : `Follow ${authorName}`
      }
      aria-pressed={localFollowing}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : localFollowing ? (
        <UserCheck className="size-4" />
      ) : (
        <UserPlus className="size-4" />
      )}
      <span>{label}</span>
    </Button>
  );
}
