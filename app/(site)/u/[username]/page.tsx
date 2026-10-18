/**
 * Public author page.
 *
 * Server Component at `/u/[username]`. Resolves the address via
 * `resolveUsername`, redirecting old spellings to the owner's current
 * canonical name and 404-ing unknown, reserved, and deleted names. It then
 * fetches the viewer-independent public identity and showcase as plain cached
 * queries, the viewer-aware action state through the authenticated fetch, and
 * passes one server clock to the client canvas.
 *
 * The "(site)" route group ensures the Navbar wraps the page.
 */

import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { notFound, redirect } from "next/navigation";
import { AuthorProfile } from "./_components/AuthorProfile";

interface ProfileRouteProps {
  params: Promise<{ username: string }>;
}

const DESCRIPTION_MAX_LENGTH = 160;

/** Always resolve against the live owner; never cache a redirect destination. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Collapses whitespace and bounds the bio to a search-friendly description. */
function boundedDescription(bio: string | null, displayName: string): string {
  const collapsed = (bio ?? "").replace(/\s+/g, " ").trim();
  if (collapsed.length > 0) return collapsed.slice(0, DESCRIPTION_MAX_LENGTH);
  return `Posts by ${displayName} on Resonance.`;
}

/**
 * The single server clock passed to the client canvas. Kept out of the
 * component body so it is a deliberate one-shot read rather than a
 * render-time expression.
 */
function readServerClock(): number {
  return Date.now();
}

export async function generateMetadata({
  params,
}: ProfileRouteProps): Promise<Metadata> {
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
    title: `${displayName} | Resonance`,
    description: boundedDescription(identity.bio, displayName),
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

  const identity = await fetchQuery(api.profiles.getPublicIdentity, {
    userId: resolved.ownerUserId,
  });

  if (!identity) {
    notFound();
  }

  const viewerProfile = await fetchAuthQuery(api.users.getUserProfile, {
    userId: resolved.ownerUserId,
  });
  const showcase = await fetchQuery(api.profiles.getShowcase, {
    userId: resolved.ownerUserId,
  });

  return (
    <div className="py-10 md:py-12">
      <AuthorProfile
        initialIdentity={identity}
        initialViewer={{
          viewerId: viewerProfile?.viewerId ?? null,
          isFollowing: viewerProfile?.isFollowing ?? false,
        }}
        initialShowcase={showcase}
        initialNow={readServerClock()}
      />
    </div>
  );
}
