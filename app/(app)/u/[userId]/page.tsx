/**
 * Public user profile page.
 *
 * Server Component at `/u/[userId]`. Fetches the public profile via
 * `getUserProfile` and renders the profile header (avatar, display name,
 * bio). A "User not found" message is shown when the user doesn't exist.
 * The post list is rendered by a Client Component so it can use
 * `usePaginatedQuery` for live pagination.
 *
 * The "(app)" route group ensures the Navbar wraps the page.
 */

import type { Metadata } from "next";
import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ProfileHeader } from "@/components/web/ProfileHeader";
import { SectionHeading } from "@/components/web/SectionHeading";
import { ProfilePostList } from "./_components/ProfilePostList";
import { EditProfileButton } from "./_components/EditProfileButton";
import { buttonVariants } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import Link from "next/link";

interface ProfileRouteProps {
  params: Promise<{ userId: string }>;
}

const getProfile = cache(async (userId: string) => {
  return await fetchQuery(api.users.getUserProfile, { userId });
});

export async function generateMetadata({
  params,
}: ProfileRouteProps): Promise<Metadata> {
  const { userId } = await params;
  const profile = await getProfile(userId);

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
        <Link
          href="/blog"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to blog
        </Link>
      </div>
    );
  }

  const displayName = profile.displayName?.trim() || "Anonymous";
  const postCountLabel = profile.postCount === 1 ? "post" : "posts";

  return (
    <div className="py-12">
      <ProfileHeader
        displayName={displayName}
        bio={profile.bio}
        avatarUrl={profile.avatarUrl}
        userId={profile.userId}
        rightAction={<EditProfileButton profileUserId={profile.userId} />}
      />

      <section className="py-10">
        <SectionHeading
          title="Posts"
          count={profile.postCount}
          countLabel={postCountLabel}
        />
        <ProfilePostList userId={profile.userId} />
      </section>
    </div>
  );
}
