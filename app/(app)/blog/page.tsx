import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCTA } from "@/components/web/AuthCTA";
import { Skeleton } from "@/components/ui/skeleton";
import { BlogFilter } from "./_components/BlogFilter";
import { BlogPostList } from "./_components/BlogPostList";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "A collection of ideas, experiments, and conversations from people who see patterns in the noise.",
};

interface BlogPageProps {
  searchParams: Promise<{ tag?: string | string[] }>;
}

export default async function BlogPost({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const tag = typeof params.tag === "string" ? params.tag : undefined;

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
      <BlogFilter tag={tag} />
      <Suspense fallback={<SkeletonLoadingUi />}>
        <BlogPostList tag={tag} />
      </Suspense>
    </div>
  );
}

function SkeletonLoadingUi() {
  return (
    <div className="grid items-stretch px-6 py-6 border-l border-r gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="pt-0 gap-4 flex flex-col h-full">
          <div className="relative h-48 w-full overflow-hidden mb-8">
            <Skeleton className="object-cover h-full w-full rounded-t-lg" />
          </div>
          <div className="flex flex-col space-y-3">
            <Skeleton className="h-6 w-full rounded bg-orange-50/40" />
            <Skeleton className="h-4 w-full rounded bg-orange-50/40" />
            <Skeleton className="h-4 w-5/6 rounded bg-orange-50/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
