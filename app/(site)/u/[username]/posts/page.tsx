/**
 * Public author post catalogue.
 *
 * Server Component at `/u/[username]/posts`. It resolves the address exactly
 * like the profile page (`resolveUsername`), redirecting preserved spellings to
 * the owner's canonical catalogue and 404-ing unknown, reserved, and deleted
 * names through the ancestor `/u/[username]/not-found.tsx` recovery.
 *
 * Beyond the address it reads only the viewer-independent public identity, to
 * render a compact header and to build metadata. The published posts stream
 * from the client (`profiles.listAuthorPosts`), so the catalogue stays live
 * without the page fetching a first page it would then discard, and no
 * viewer-aware query runs here.
 *
 * The "(site)" route group ensures the Navbar wraps the page.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { ArrowLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/web/UserAvatar";
import { buildProfilePath } from "@/lib/username";
import { boundProfileDescription } from "@/lib/constants/seo";
import { AuthorCatalogue } from "./_components/AuthorCatalogue";

interface CatalogueRouteProps {
  params: Promise<{ username: string }>;
}

/** Always resolve against the live owner; never cache a redirect destination. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: CatalogueRouteProps): Promise<Metadata> {
  const { username } = await params;
  const resolved = await fetchQuery(api.usernames.resolveUsername, {
    username,
  });
  if (resolved.kind !== "profile") return { title: "Profile not found" };

  const identity = await fetchQuery(api.profiles.getPublicIdentity, {
    userId: resolved.ownerUserId,
  });
  if (!identity) return { title: "Profile not found" };

  const displayName = identity.displayName.trim() || "Anonymous";

  return {
    title: `All posts by ${displayName} | Resonance`,
    description: boundProfileDescription(identity.bio, displayName),
  };
}

export default async function CatalogueRoute({ params }: CatalogueRouteProps) {
  const { username } = await params;
  const resolved = await fetchQuery(api.usernames.resolveUsername, {
    username,
  });

  if (resolved.kind === "redirect") {
    // The catalogue address carries the same spelling rules as the profile.
    redirect(`/u/${resolved.username}/posts`);
  }

  if (resolved.kind === "notFound") {
    notFound();
  }

  const identity = await fetchQuery(api.profiles.getPublicIdentity, {
    userId: resolved.ownerUserId,
  });

  if (!identity) {
    notFound();
  }

  const displayName = identity.displayName.trim() || "Anonymous";
  // The public identity is the live canonical spelling; the same source feeds
  // the catalogue so a stale address cannot reach the client.
  const profileUsername = identity.username;

  return (
    <div className="py-10 md:py-12">
      <header className="flex flex-wrap items-center gap-x-[15px] gap-y-[18px] px-[25px] pb-[27px] md:px-[42px]">
        <UserAvatar
          userId={identity.userId}
          name={displayName}
          avatarUrl={identity.avatarUrl}
          className="size-[58px] ring-4 ring-background md:size-[78px]"
        />
        <div className="min-w-0">
          <h1 className="text-[clamp(28px,4.5vw,44px)] leading-[1.05] font-semibold tracking-[-0.05em] [overflow-wrap:anywhere]">
            {displayName}
          </h1>
          {profileUsername !== null ? (
            <p className="mt-[6px] text-[12px] text-muted-foreground md:text-[13px]">
              @{profileUsername}
            </p>
          ) : null}
        </div>
        {profileUsername !== null ? (
          <Link
            href={buildProfilePath(profileUsername)}
            className="ml-auto flex shrink-0 items-center gap-2 text-[12px] text-[#ab4a22] hover:underline md:text-[13px] dark:text-[#efa471]"
          >
            <ArrowLeft aria-hidden="true" className="size-[15px]" />
            Back to profile
          </Link>
        ) : null}
      </header>

      <AuthorCatalogue userId={identity.userId} username={profileUsername} />
    </div>
  );
}
