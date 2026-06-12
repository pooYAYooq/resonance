/**
 * Profile hero for the public profile page and future own-profile
 * surfaces. Renders the avatar, display name as an `<h1>`, the bio,
 * and an optional right-side action (e.g. the "Edit Profile" button).
 *
 * The post count is intentionally not rendered here — it lives next
 * to the section heading on the consumer side, where the post list
 * actually is.
 *
 * Pure presentational component. No Convex hooks, no auth.
 */

import { UserAvatar } from "./UserAvatar";

interface ProfileHeaderProps {
  /** Display name rendered as the page-level `<h1>`. */
  displayName: string;
  /** Optional bio. Hidden when null, undefined, empty, or whitespace. */
  bio?: string | null;
  /** Optional avatar URL passed through to `UserAvatar`. */
  avatarUrl?: string | null;
  /** Better Auth user ID of the profile owner. */
  userId: string;
  /**
   * Optional right-side action (e.g. the "Edit Profile" button).
   * Anchored top-right on `md:` and stacked below the content on
   * mobile.
   */
  rightAction?: React.ReactNode;
}

export function ProfileHeader({
  displayName,
  bio,
  avatarUrl,
  userId,
  rightAction,
}: ProfileHeaderProps) {
  const hasBio = !!bio && bio.trim().length > 0;

  return (
    <div className="relative flex flex-col md:flex-row md:items-center gap-6 pb-8 border-b border-border">
      <UserAvatar
        userId={userId}
        name={displayName}
        avatarUrl={avatarUrl}
        className="size-20 md:size-24"
      />
      <div className="flex-1 space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          {displayName}
        </h1>
        {hasBio ? (
          <p className="text-muted-foreground max-w-prose">{bio}</p>
        ) : null}
      </div>
      {rightAction ? (
        <div className="md:absolute md:top-0 md:right-0">{rightAction}</div>
      ) : null}
    </div>
  );
}
