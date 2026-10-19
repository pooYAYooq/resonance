/**
 * Approved public author canvas.
 *
 * Composes the server-rendered public identity with two live subscriptions: the
 * viewer-independent `getPublicIdentity` for every display field, and the
 * viewer-aware `getUserProfile` for the action state only. The hero band carries
 * the kicker (country and join date), the name, and the harmonic-wave artwork;
 * the profile row carries the avatar, introduction, social links, stats, and the
 * edit/follow action; the showcase carries the bounded work.
 *
 * Identity arrives from the public query so an edit to any field (name, country,
 * socials, join-date preference) updates without a reload; the server value
 * holds until the first result. The viewer query is skipped while auth resolves
 * so the server-passed action state holds, then it runs for signed-in and
 * signed-out viewers alike and replaces that state, so a follow from another
 * session or a different account cannot leak through. Counts stay reactive
 * inside `ProfileStats`.
 */

"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthorJoinedDate } from "@/components/web/AuthorJoinedDate";
import { HarmonicWaves } from "@/components/web/HarmonicWaves";
import { ProfileActionButton } from "@/components/web/ProfileActionButton";
import { ProfileStats } from "@/components/web/ProfileStats";
import { UserAvatar } from "@/components/web/UserAvatar";
import { getProfileCountryName } from "@/lib/constants/profile-countries";
import {
  SOCIAL_LABELS,
  SOCIAL_PLATFORMS,
  type SocialProfiles,
} from "@/lib/profile-socials";
import type { JoinDateDisplay } from "@/lib/profile-identity";
import { AuthorShowcase, type ShowcaseView } from "./AuthorShowcase";

export type PublicIdentityView = {
  userId: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  socialProfiles: SocialProfiles;
  joinedAt: number | null;
  joinDateDisplay: JoinDateDisplay;
  followerCount: number;
  followingCount: number;
  postCount: number;
};

interface AuthorProfileProps {
  /** Server-rendered, viewer-independent public identity. */
  initialIdentity: PublicIdentityView;
  /** Server-rendered viewer state for the action button. */
  initialViewer: { viewerId: string | null; isFollowing: boolean };
  /** Server-rendered showcase. */
  initialShowcase: ShowcaseView;
  /** One server clock, reused until the client mounts. */
  initialNow: number;
}

export function AuthorProfile({
  initialIdentity,
  initialViewer,
  initialShowcase,
  initialNow,
}: AuthorProfileProps) {
  const { isLoading } = useConvexAuth();
  // Identity is public and viewer-independent, so it is not auth-gated; the
  // server value renders until the first live result arrives.
  const liveIdentity = useQuery(api.profiles.getPublicIdentity, {
    userId: initialIdentity.userId,
  });
  // The viewer-aware read exists only for the action state and is skipped while
  // auth resolves.
  const liveViewer = useQuery(
    api.users.getUserProfile,
    isLoading ? "skip" : { userId: initialIdentity.userId },
  );

  const identity = liveIdentity ?? initialIdentity;
  const viewer = liveViewer
    ? { viewerId: liveViewer.viewerId, isFollowing: liveViewer.isFollowing }
    : initialViewer;

  const displayName = identity.displayName.trim() || "Anonymous";
  const countryName = getProfileCountryName(identity.countryCode);
  const hasJoined = identity.joinedAt !== null;
  const hasKicker = countryName !== null || hasJoined;
  const bio =
    identity.bio && identity.bio.trim().length > 0 ? identity.bio : null;
  const hasSocials = SOCIAL_PLATFORMS.some((platform) =>
    Boolean(identity.socialProfiles[platform]),
  );

  return (
    <div className="flex min-w-0 flex-col">
      <div className="relative flex min-h-[178px] flex-col justify-center overflow-hidden rounded-lg bg-[#f5efe7] px-[25px] py-[30px] md:min-h-[216px] md:px-[42px] md:py-[39px] dark:bg-[#30231e]">
        <HarmonicWaves />
        {hasKicker ? (
          <p className="relative z-1 flex flex-wrap items-center gap-x-[9px] gap-y-[5px] text-[10px] tracking-[0.025em] text-[#33261e] opacity-80 md:text-[11px] dark:text-[#f1ddd0]">
            {countryName !== null ? <span>{countryName}</span> : null}
            {countryName !== null && hasJoined ? (
              <span aria-hidden="true">·</span>
            ) : null}
            {hasJoined ? (
              <AuthorJoinedDate
                joinedAt={identity.joinedAt}
                display={identity.joinDateDisplay}
                initialNow={initialNow}
              />
            ) : null}
          </p>
        ) : null}
        <h1 className="relative z-1 mt-[14px] max-w-[270px] text-[clamp(35px,5.5vw,65px)] leading-[1.03] font-semibold tracking-[-0.075em] text-[#33261e] [overflow-wrap:anywhere] md:max-w-[580px] dark:text-[#f1ddd0]">
          {displayName}
        </h1>
      </div>

      <div className="grid grid-cols-[58px_minmax(0,1fr)] items-start gap-x-[15px] gap-y-[18px] px-[25px] pt-[27px] pb-[30px] md:grid-cols-[78px_minmax(0,1fr)_auto] md:gap-[23px] md:px-[42px] md:pt-[28px] md:pb-[35px]">
        <UserAvatar
          userId={identity.userId}
          name={displayName}
          avatarUrl={identity.avatarUrl}
          className="size-[58px] ring-4 ring-background md:size-[78px]"
        />

        <div className="min-w-0 max-w-[590px] space-y-[13px]">
          {bio ? (
            <p className="text-[13px] leading-[1.8] whitespace-pre-line text-muted-foreground md:text-[14px]">
              {bio}
            </p>
          ) : null}

          {hasSocials ? (
            <nav
              aria-label="Author social links"
              className="flex flex-wrap gap-x-[16px] gap-y-1 text-[12px] md:text-[11px]"
            >
              {SOCIAL_PLATFORMS.map((platform) => {
                const url = identity.socialProfiles[platform];
                if (!url) return null;
                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className="text-[#ab4a22] hover:underline dark:text-[#efa471]"
                  >
                    {SOCIAL_LABELS[platform]} <span aria-hidden="true">↗</span>
                  </a>
                );
              })}
            </nav>
          ) : null}

          <div className="pt-[7px]">
            <ProfileStats
              profileUserId={identity.userId}
              initialFollowerCount={identity.followerCount}
              initialFollowingCount={identity.followingCount}
            />
          </div>
        </div>

        <div className="col-start-2 row-start-2 md:col-start-3 md:row-start-1 md:justify-self-end">
          <ProfileActionButton
            profileUserId={identity.userId}
            authorName={displayName}
            viewerId={viewer.viewerId}
            isFollowing={viewer.isFollowing}
          />
        </div>
      </div>

      <AuthorShowcase
        userId={identity.userId}
        username={identity.username}
        initialShowcase={initialShowcase}
      />
    </div>
  );
}
