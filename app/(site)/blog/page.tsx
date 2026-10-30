import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCTA } from "@/components/web/AuthCTA";
import Link from "next/link";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import {
  buildDiscoverLatestLink,
  normalizeDiscoverParams,
  type DiscoverParams,
} from "@/lib/discover";
import { DiscoverSearch } from "./_components/DiscoverSearch";
import { BlogTopicsMenu } from "./_components/BlogTopicsMenu";
import { ResultsAnchorScroll } from "./_components/ResultsAnchorScroll";
import { StickyBlogFilter } from "./_components/StickyBlogFilter";
import { DiscoverTopics } from "./_components/DiscoverTopics";
import { DiscoverResultsSkeleton } from "./_components/DiscoverStates";
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
  const topics = await fetchAuthQuery(api.discover.getTopics, {});
  const modeKey =
    mode.mode === "topic"
      ? `topic:${mode.tag}`
      : mode.mode === "search"
        ? `search:${mode.query}`
        : "latest";

  return (
    <div className="container mx-auto">
      <div
        data-testid="blog-hero"
        className="-mx-4 pt-0 pb-8 sm:pb-10 md:mx-0 md:pt-8 lg:pt-12"
      >
        <div className="relative border border-primary/5 bg-linear-to-br from-muted/20 via-muted/10 to-primary/5 p-6 sm:p-10 lg:p-16 overflow-hidden">
          <div className="absolute -top-100 -right-50 w-20 h-240 bg-primary/3 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/2 rounded-full blur-3xl" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3 sm:mb-4">
              Resonance / Blog
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 sm:mb-6">
              Stories that echo
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-[50ch] leading-relaxed">
              <span className="sm:hidden">
                Ideas, experiments, and conversations from curious minds.
              </span>
              <span className="hidden sm:inline">
                A collection of ideas, experiments, and conversations from
                people who see patterns in the noise.
              </span>
            </p>
            <AuthCTA className="mt-6 sm:mt-8" />
          </div>
        </div>
      </div>
      <StickyBlogFilter>
        <div
          data-testid="blog-filter-bar"
          className="flex flex-col gap-3 [@media(max-height:500px)_and_(orientation:landscape)]:flex-row sm:flex-row sm:items-start"
        >
          <div className="min-w-0 flex-1">
            <DiscoverSearch query={mode.mode === "search" ? mode.query : ""} />
          </div>
          <BlogTopicsMenu topics={topics} mode={mode} />
        </div>
      </StickyBlogFilter>
      <ResultsAnchorScroll modeKey={modeKey} />
      {/* Results stay before the rail in DOM order so mobile readers encounter content first. */}
      <div className="mt-8 grid items-start gap-8 pb-10 sm:pb-12 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <main>
          <div
            id="blog-results"
            className="mb-5 flex scroll-mt-[236px] items-center justify-between gap-4 border-b pb-4 [@media(max-height:500px)_and_(orientation:landscape)]:scroll-mt-[96px] sm:scroll-mt-[168px] md:scroll-mt-[160px]"
          >
            <h2 className="text-2xl font-semibold">
              {mode.mode === "search"
                ? `Search results for “${mode.query}”`
                : mode.mode === "topic"
                  ? mode.tag
                  : "All posts"}
            </h2>
            {mode.mode !== "latest" ? (
              <Link
                href={`${buildDiscoverLatestLink()}#blog-results`}
                className="shrink-0 whitespace-nowrap text-sm font-medium text-primary hover:underline"
              >
                All posts
              </Link>
            ) : null}
          </div>
          <Suspense fallback={<DiscoverResultsSkeleton />}>
            <BlogPostList mode={mode} />
          </Suspense>
          {mode.mode !== "latest" ? (
            <div aria-hidden="true" className="h-20" />
          ) : null}
        </main>
        <div
          data-testid="blog-topics-sidebar"
          className="hidden xl:sticky xl:top-[138px] xl:block"
        >
          <DiscoverTopics mode={mode} topics={topics} />
        </div>
      </div>
    </div>
  );
}
