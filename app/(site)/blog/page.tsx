import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCTA } from "@/components/web/AuthCTA";
import Link from "next/link";
import {
  buildDiscoverLatestLink,
  normalizeDiscoverParams,
  type DiscoverParams,
} from "@/lib/discover";
import { DiscoverSearch } from "./_components/DiscoverSearch";
import { DiscoverTopics } from "./_components/DiscoverTopics";
import {
  DiscoverResultsSkeleton,
  DiscoverTopicsSkeleton,
} from "./_components/DiscoverStates";
import { BlogPostList } from "./_components/BlogPostList";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "A collection of ideas, experiments, and conversations from people who see patterns in the noise.",
};

interface BlogPageProps {
  searchParams: Promise<DiscoverParams>;
}

/**
 * Renders the blog discovery page using a normalized Discover mode.
 *
 * Search queries become `search`, canonical tags become `topic`, and all other
 * inputs become `latest`.
 *
 * @param searchParams - Query parameters used to select the Discover mode.
 * @returns The rendered blog page.
 */
export default async function BlogPost({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const mode = normalizeDiscoverParams(params);

  return (
    <div className="container mx-auto">
      <div className="pt-24 pb-20 sm:pb-24">
        <div className="relative border border-primary/5 bg-linear-to-br from-muted/20 via-muted/10 to-primary/5 p-8 sm:p-12 lg:p-16 overflow-hidden">
          <div className="absolute -top-100 -right-50 w-20 h-240 bg-primary/3 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/2 rounded-full blur-3xl" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
              Resonance / Blog
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
              Stories that echo
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-[50ch] leading-relaxed">
              A collection of ideas, experiments, and conversations from people
              who see patterns in the noise.
            </p>
            <AuthCTA className="mt-8" />
          </div>
        </div>
      </div>
      <div className="px-6">
        <DiscoverSearch query={mode.mode === "search" ? mode.query : ""} />
      </div>
      {/* Results stay before the rail in DOM order so mobile readers encounter content first. */}
      <div className="mt-8 grid items-start gap-8 px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main>
          <div className="mb-5 flex items-center justify-between gap-4 border-b pb-4">
            <h2 className="text-2xl font-semibold">
              {mode.mode === "search"
                ? `Search results for “${mode.query}”`
                : mode.mode === "topic"
                  ? mode.tag
                  : "Latest"}
            </h2>
            {mode.mode !== "latest" ? (
              <Link
                href={buildDiscoverLatestLink()}
                className="text-sm font-medium text-primary hover:underline"
              >
                Latest
              </Link>
            ) : null}
          </div>
          <Suspense fallback={<DiscoverResultsSkeleton />}>
            <BlogPostList mode={mode} />
          </Suspense>
        </main>
        <Suspense fallback={<DiscoverTopicsSkeleton />}>
          <DiscoverTopics mode={mode} />
        </Suspense>
      </div>
    </div>
  );
}
