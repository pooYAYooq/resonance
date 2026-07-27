/**
 * ProfileStats — reactive follower/following counts row.
 *
 * Subscribes to `getFollowCounts` so the displayed counts bump live
 * the moment `toggleFollow` patches the `users` doc. Falls back to
 * the `initial*` props (passed from the cached server fetch) while
 * the query is loading, so SSR is not blocked and first paint shows
 * the server-rendered values.
 *
 * Pure presentational shape; the caller (`ProfileHeader` `stats`
 * slot) owns placement and surrounding markup.
 */

"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface ProfileStatsProps {
  /** Better Auth user ID of the profile owner. */
  profileUserId: string;
  /** Server-rendered fallback counts (from cached `getUserProfile`). */
  initialFollowerCount?: number;
  initialFollowingCount?: number;
}

export function ProfileStats({
  profileUserId,
  initialFollowerCount = 0,
  initialFollowingCount = 0,
}: ProfileStatsProps) {
  const counts = useQuery(api.follows.getFollowCounts, {
    userId: profileUserId,
  });

  const followerCount = counts?.followerCount ?? initialFollowerCount;
  const followingCount = counts?.followingCount ?? initialFollowingCount;

  return (
    <div aria-label="Profile stats" className="flex gap-4">
      <span>
        {followerCount} {followerCount === 1 ? "Follower" : "Followers"}
      </span>
      <span aria-hidden="true">·</span>
      <span>{followingCount} Following</span>
    </div>
  );
}