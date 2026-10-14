/**
 * Public user profile page.
 *
 * Server Component at `/u/[userId]`. Fetches the public profile via
 * `getUserProfile` and renders the profile header (avatar, display name,
 * bio). A "User not found" message is shown when the user doesn't exist.
 * The post list is rendered by a Client Component so it can use
 * `usePaginatedQuery` for live pagination.
 *
 * The "(site)" route group ensures the Navbar wraps the page.
 */

import type { Metadata } from "next";
import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { ProfileHeader } from "@/components/web/ProfileHeader";
import { SectionHeading } from "@/components/web/SectionHeading";
import { ProfilePostList } from "./_components/ProfilePostList";
import { ProfileActionButton } from "@/components/web/ProfileActionButton";
import { ProfileStats } from "@/components/web/ProfileStats";
import { CoverImage } from "@/components/web/CoverImage";
import { buttonVariants } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import Link from "next/link";

interface ProfileRouteProps {
  params: Promise<{ userId: string }>;
}

const getProfile = cache(async (userId: string) => {
  return await fetchAuthQuery(api.users.getUserProfile, { userId });
});

export async function generateMetadata({
  params,
}: ProfileRouteProps): Promise<Metadata> {
  const { userId } = await params;
  const profile = await fetchQuery(api.users.getUserProfile, { userId });

  if (!profile) {
    return { title: "User not found" };
  }

  return {
    title: `${profile.displayName} | Resonance`,
    description: profile.bio || `Posts by ${profile.displayName} on Resonance.`,
  };
}

export default async function ProfileRoute({ params }: ProfileRouteProps) {
  const { userId } = await params;
  const profile = await getProfile(userId);

  if (!profile) {
    return (
      <div className="py-24 text-center">
        <BookOpen
          className="mx-auto size-12 text-muted-foreground mb-4"
          strokeWidth={1.5}
        />
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">
          User not found
        </h1>
        <p className="text-muted-foreground mb-8">
          The profile you are looking for does not exist.
        </p>
        <Link href="/blog" className={buttonVariants({ variant: "outline" })}>
          Back to blog
        </Link>
      </div>
    );
  }

  const displayName = profile.displayName?.trim() || "Anonymous";
  const postCountLabel = profile.postCount === 1 ? "post" : "posts";
  const showcase = await fetchQuery(api.profiles.getShowcase, {
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

      {showcase.mode === "selected" && showcase.posts.length > 0 && (
        <section
          aria-label="Featured posts"
          className="flex flex-col gap-6 pt-10"
        >
          <SectionHeading title="Featured posts" />
          <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {showcase.posts.map((post) => (
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
