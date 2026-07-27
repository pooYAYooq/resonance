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
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buttonVariants, Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { FollowButton } from "./FollowButton";

interface ProfileActionButtonProps {
  /** Better Auth user ID of the profile owner. */
  profileUserId: string;
  /** Display name of the profile owner, used by `FollowButton` toasts. */
  authorName: string;
}

export function ProfileActionButton({
  profileUserId,
  authorName,
}: ProfileActionButtonProps) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const router = useRouter();

  // While the current-user query is loading, render nothing.
  if (currentUser === undefined) return null;

  // Anonymous viewer — render a styled "Follow" button that redirects.
  if (currentUser === null) {
    return (
      <Button
        variant="outline"
        onClick={() => router.push("/auth/login")}
        aria-label={`Follow ${authorName}`}
      >
        Follow
      </Button>
    );
  }

  // Own profile — Edit Profile (unchanged UX from `EditProfileButton`).
  if (currentUser.userId === profileUserId) {
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
  return <FollowButton profileUserId={profileUserId} authorName={authorName} />;
}