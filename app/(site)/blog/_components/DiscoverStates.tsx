import { Skeleton } from "@/components/ui/skeleton";

// Loading states reserve independent space for results and the topic rail.
export function DiscoverResultsSkeleton() {
  return (
    <div
      data-testid="discover-results-skeleton"
      className="flex flex-col gap-6"
    >
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-sm border md:grid md:grid-cols-[2fr_3fr]"
        >
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DiscoverTopicsSkeleton() {
  return (
    <div
      data-testid="discover-topics-skeleton"
      className="flex flex-col gap-4 border p-5"
    >
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  );
}
