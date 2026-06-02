/**
 * Resonance landing page.
 *
 * Composes a full-page marketing experience from dedicated section
 * components: Hero, Features, Recent Posts (with Suspense skeleton),
 * Community Stats, and an Explore placeholder for future categories.
 *
 * Auth-aware CTAs are handled by `<AuthCTA />` (hero, blog hero) and
 * `<FooterCTA />` (footer), ensuring consistent labels:
 *   authenticated → "Write a post"
 *   unauthenticated → "Get Started"
 *
 * All section components are React Server Components where possible.
 * Dynamic data (recent posts, stats) is fetched server-side via Convex.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { HeroSection } from "@/app/(app)/_components/HeroSection";
import { FeaturesSection } from "@/app/(app)/_components/FeaturesSection";
import { RecentPostsSection } from "@/app/(app)/_components/RecentPostsSection";
import { RecentPostsSkeleton } from "@/app/(app)/_components/RecentPostsSkeleton";
import { StatsSection } from "@/app/(app)/_components/StatsSection";
import { ExploreSection } from "@/app/(app)/_components/ExploreSection";

export const metadata: Metadata = {
  title: "RESONANCE | Write, Share, Connect",
  description:
    "A blog platform for sharing thoughts, ideas, and stories that echo. Join a community of curious minds.",
};

export default function Home() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <FeaturesSection />
      <Suspense fallback={<RecentPostsSkeleton />}>
        <RecentPostsSection />
      </Suspense>
      <StatsSection />
      <ExploreSection />
    </div>
  );
}
