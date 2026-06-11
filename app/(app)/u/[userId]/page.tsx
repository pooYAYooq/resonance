/**
 * Public user profile page.
 *
 * Server Component at `/u/[userId]`. Fetches the public profile via
 * `getUserProfile` and renders the profile header (avatar, display name,
 * bio, post count). A "User not found" message is shown when the user
 * doesn't exist. The post list is rendered by a Client Component so it
 * can use `usePaginatedQuery` for live pagination.
 *
 * The "(app)" route group ensures the Navbar wraps the page.
 */

import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/web/UserAvatar";
import { ProfilePostList } from "./_components/ProfilePostList";
import { EditProfileButton } from "./_components/EditProfileButton";

interface ProfileRouteProps {
  params: Promise<{ userId: string }>;
}

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
  const profile = await fetchQuery(api.users.getUserProfile, { userId });

  if (!profile) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">
          User not found
        </h1>
        <p className="text-muted-foreground">
          The profile you are looking for does not exist.
        </p>
      </div>
    );
  }

  const displayName = profile.displayName?.trim() || "Anonymous";
  const hasBio = !!profile.bio && profile.bio.trim().length > 0;

  return (
    <div className="py-12">
      <header className="flex flex-col items-center text-center gap-4 pb-8 border-b border-border">
        <UserAvatar
          userId={profile.userId}
          name={displayName}
          avatarUrl={profile.avatarUrl}
          className="size-24"
        />
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {displayName}
          </h1>
          {hasBio && (
            <p className="text-muted-foreground max-w-prose mx-auto">
              {profile.bio}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {profile.postCount}{" "}
            {profile.postCount === 1 ? "post" : "posts"}
          </p>
        </div>
        <EditProfileButton profileUserId={profile.userId} />
      </header>

      <section className="py-10">
        <h2 className="text-2xl font-bold tracking-tight mb-6">
          Posts
        </h2>
        <ProfilePostList userId={profile.userId} />
      </section>
    </div>
  );
}
