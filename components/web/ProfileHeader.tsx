/**
 * Profile hero for the public profile page and future own-profile
 * surfaces. Renders the avatar, display name as an `<h1>`, the bio,
 * an optional `stats` row under the bio (e.g. follower/following
 * counts), and an optional right-side action (e.g. the follow /
 * edit-profile button).
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
   * Optional right-side action (e.g. the Edit Profile / Follow button).
   * Anchored top-right on `md:` and stacked below the content on
   * mobile.
   */
  rightAction?: React.ReactNode;
  /**
   * Optional stats row rendered under the name/bio block (e.g.
   * `<ProfileStats>`). Presentational slot only — the consumer owns
   * any reactive subscriptions.
   */
  stats?: React.ReactNode;
}

export function ProfileHeader({
  displayName,
  bio,
  avatarUrl,
  userId,
  rightAction,
  stats,
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
        {stats ? (
          <div className="text-sm text-muted-foreground">{stats}</div>
        ) : null}
      </div>
      {rightAction ? (
        <div className="md:absolute md:top-0 md:right-0">{rightAction}</div>
      ) : null}
    </div>
  );
}
