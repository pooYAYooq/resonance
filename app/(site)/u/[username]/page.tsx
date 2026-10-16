/**
 * Public user profile page.
 *
 * Server Component at `/u/[username]`. Resolves the address via
 * `resolveUsername`, redirecting old spellings to the owner's current
 * canonical name and 404-ing unknown, reserved, and deleted names. The
 * resolved profile renders the header (avatar, display name, bio), featured
 * posts, and the post list, which is a Client Component so it can use
 * `usePaginatedQuery` for live pagination.
 *
 * The "(site)" route group ensures the Navbar wraps the page.
 */

import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { ProfileHeader } from "@/components/web/ProfileHeader";
import { SectionHeading } from "@/components/web/SectionHeading";
import { ProfilePostList } from "./_components/ProfilePostList";
import { ProfileActionButton } from "@/components/web/ProfileActionButton";
import { ProfileStats } from "@/components/web/ProfileStats";
import { CoverImage } from "@/components/web/CoverImage";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

interface ProfileRouteProps {
  params: Promise<{ username: string }>;
}

/** Always resolve against the live owner; never cache a redirect destination. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: ProfileRouteProps): Promise<Metadata> {
  const { username } = await params;
  const resolved = await fetchQuery(api.usernames.resolveUsername, {
    username,
  });
  if (resolved.kind !== "profile") return { title: "Profile not found" };

  const profile = await fetchQuery(api.users.getUserProfile, {
    userId: resolved.ownerUserId,
  });
  if (!profile) return { title: "Profile not found" };

  return {
    title: `${profile.displayName} | Resonance`,
    description: profile.bio || `Posts by ${profile.displayName} on Resonance.`,
  };
}

export default async function ProfileRoute({ params }: ProfileRouteProps) {
  const { username } = await params;
  const resolved = await fetchQuery(api.usernames.resolveUsername, {
    username,
  });

  if (resolved.kind === "redirect") {
    redirect(`/u/${resolved.username}`);
  }

  if (resolved.kind === "notFound") {
    notFound();
  }

  const profile = await fetchAuthQuery(api.users.getUserProfile, {
    userId: resolved.ownerUserId,
  });

  if (!profile) {
    notFound();
  }

  const displayName = profile.displayName?.trim() || "Anonymous";
  const postCountLabel = profile.postCount === 1 ? "post" : "posts";
  const featured = await fetchQuery(api.profiles.getSelectedShowcase, {
    userId: profile.userId,
  });

  return (
    <div className="py-12">
      <ProfileHeader
        displayName={displayName}
        bio={profile.bio}
        avatarUrl={profile.avatarUrl}
        userId={profile.userId}
        joinedDate={profile.joinedDate}
        rightAction={
          <ProfileActionButton
            profileUserId={profile.userId}
            authorName={displayName}
            viewerId={profile.viewerId}
            isFollowing={profile.isFollowing}
          />
        }
        stats={
          <ProfileStats
            profileUserId={profile.userId}
            initialFollowerCount={profile.followerCount ?? 0}
            initialFollowingCount={profile.followingCount ?? 0}
          />
        }
      />

      {featured.length > 0 && (
        <section
          aria-label="Featured posts"
          className="flex flex-col gap-6 pt-10"
        >
          <SectionHeading title="Featured posts" />
          <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((post) => (
              <li key={post.postId} className="min-w-0">
                <Link
                  href={`/blog/${post.postId}`}
                  className="flex cursor-pointer flex-col gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="relative aspect-[3/2] overflow-hidden rounded-md bg-muted">
                    <CoverImage
                      src={post.imageUrl}
                      alt=""
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </span>
                  <span className="line-clamp-2 font-medium">{post.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="py-10">
        <SectionHeading
          title="Posts"
          count={profile.postCount ?? undefined}
          countLabel={postCountLabel}
        />
        <ProfilePostList userId={profile.userId} />
      </section>
    </div>
  );
}
