/**
 * Skeleton loading state for the Recent Posts section.
 *
 * Mirrors the dimensions and layout of the actual post cards for a
 * seamless Suspense transition.
 */

import { Skeleton } from "@/components/ui/skeleton";

export function RecentPostsSkeleton() {
  return (
    <section className="py-16 md:py-24 bg-muted/5 border-y border-border">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-96" />
          </div>
          <Skeleton className="hidden sm:block h-10 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-4 rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden"
            >
              <Skeleton className="h-56 w-full rounded-none" />
              <div className="px-6 pb-6 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
              <div className="px-6 pb-6 flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
