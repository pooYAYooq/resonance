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
  /** Compact byline sizing; profile actions retain the default size. */
  size?: "default" | "sm";
  /** Label for the available follow action in context, such as notifications. */
  followLabel?: string;
  onActivate?: () => void;
  /** Compact treatments for notification row actions. */
  presentation?: "default" | "icon" | "quiet";
}

export function FollowButton({
  profileUserId,
  authorName,
  isFollowing,
  size = "default",
  followLabel = "Follow",
  onActivate,
  presentation = "default",
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

  const resolvingFollow = isAuthenticated && isFollowingQuery === undefined;
  const handleClick = () => {
    if (isPending || isLoading || resolvingFollow) return;
    if (!isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
      return;
    }

    onActivate?.();
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

  const label = localFollowing ? "Following" : followLabel;

  return (
    <Button
      variant={
        presentation !== "default"
          ? "ghost"
          : localFollowing
            ? "default"
            : "outline"
      }
      className={
        presentation !== "default"
          ? localFollowing
            ? "text-follow-active hover:text-destructive focus-visible:text-destructive"
            : "text-follow-action hover:text-follow-action"
          : undefined
      }
      size={presentation === "icon" ? "icon-sm" : size}
      title={
        presentation !== "default"
          ? localFollowing
            ? "Following · click to unfollow"
            : followLabel
          : undefined
      }
      onClick={handleClick}
      disabled={isPending || isLoading || resolvingFollow}
      aria-label={
        localFollowing
          ? `Unfollow ${authorName}`
          : `${followLabel} ${authorName}`
      }
      aria-pressed={localFollowing}
    >
      {isPending ? (
        <Loader2
          data-icon={presentation === "icon" ? undefined : "inline-start"}
          className="animate-spin"
        />
      ) : localFollowing ? (
        <UserCheck
          data-icon={presentation === "icon" ? undefined : "inline-start"}
        />
      ) : (
        <UserPlus
          data-icon={presentation === "icon" ? undefined : "inline-start"}
        />
      )}
      {presentation !== "icon" && (
        <span className="inline-grid">
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1"
          >
            {followLabel.length > "Following".length
              ? followLabel
              : "Following"}
          </span>
          <span className="col-start-1 row-start-1">{label}</span>
        </span>
      )}
    </Button>
  );
}
