/**
 * ProfileActionButton — owns the single `rightAction` slot on the
 * profile page. Renders one of three affordances based on the
 * viewer's identity:
 *
 *  - own profile     → "Edit Profile" link to `/settings`
 *  - someone else    → `FollowButton` (authenticated)
 *  - anonymous       → styled "Follow" button that redirects to login
 *
 * Consolidates the previous `EditProfileButton` with the new follow
 * affordance so both don't each issue a `getCurrentUser`
 * subscription on the same page. The Edit Profile branch preserves
 * the exact UX of `EditProfileButton`.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants, Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { FollowButton } from "./FollowButton";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";

interface ProfileActionButtonProps {
  /** Better Auth user ID of the profile owner. */
  profileUserId: string;
  /** Display name of the profile owner, used by `FollowButton` toasts. */
  authorName: string;
  /** Authenticated viewer ID, or null for an anonymous visitor. */
  viewerId: string | null;
  /** Server-derived follow state for this viewer and profile. */
  isFollowing: boolean;
}

export function ProfileActionButton({
  profileUserId,
  authorName,
  viewerId,
  isFollowing,
}: ProfileActionButtonProps) {
  const router = useRouter();

  // Anonymous viewer — render a styled "Follow" button that redirects.
  if (viewerId === null) {
    return (
      <Button
        variant="outline"
        onClick={() =>
          router.push(buildAuthHref("/auth/login", getCurrentReturnTo()))
        }
        aria-label={`Follow ${authorName}`}
      >
        Follow
      </Button>
    );
  }

  // Own profile — Edit Profile (unchanged UX from `EditProfileButton`).
  if (viewerId === profileUserId) {
    return (
      <Link
        href="/settings"
        className={buttonVariants({
          variant: "outline",
          className: "space-x-2",
        })}
      >
        <Settings className="size-4" />
        <span>Edit Profile</span>
      </Link>
    );
  }

  // Someone else's profile — FollowButton.
  return (
    <FollowButton
      profileUserId={profileUserId}
      authorName={authorName}
      isFollowing={isFollowing}
    />
  );
}
