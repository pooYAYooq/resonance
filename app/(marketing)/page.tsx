/**
 * Resonance landing page.
 *
 * Composes a full-page marketing experience from dedicated section
 * components: Hero, Features, Recent Posts (with Suspense skeleton),
 * and Community Stats.
 *
 * All section components are React Server Components where possible.
 * Dynamic data (recent posts, stats) is fetched server-side via Convex.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { HeroSection } from "@/app/(marketing)/_components/HeroSection";
import { FeaturesSection } from "@/app/(marketing)/_components/FeaturesSection";
import { RecentPostsSection } from "@/app/(marketing)/_components/RecentPostsSection";
import { RecentPostsSkeleton } from "@/app/(marketing)/_components/RecentPostsSkeleton";
import { StatsSection } from "@/app/(marketing)/_components/StatsSection";

export const metadata: Metadata = {
  title: "RESONANCE | Write, Share, Connect",
  description:
    "A blog platform for sharing thoughts, ideas, and stories that echo. Join a community of curious minds.",
};

export default async function Home() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col">
      <HeroSection />
      <FeaturesSection />
      <Suspense fallback={<RecentPostsSkeleton />}>
        <RecentPostsSection />
      </Suspense>
      <StatsSection />
    </div>
  );
}
