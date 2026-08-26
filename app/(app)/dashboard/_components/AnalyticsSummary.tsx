"use client";

import { useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";

export function AnalyticsSummary() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [asOf] = useState(() => Date.now());
  const summary = useQuery(
    api.analytics.getSummary,
    isAuthenticated ? { asOf } : "skip",
  );

  if (isLoading || (isAuthenticated && summary === undefined)) {
    return (
      <div
        className="flex justify-center py-8"
        role="status"
        aria-label="Loading analytics"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !summary) return null;

  const followerGrowthLabel = `${summary.followerGrowth} follower${summary.followerGrowth === 1 ? "" : "s"} gained in the last 30 days`;

  return (
    <section aria-labelledby="analytics-title" className="space-y-4">
      <h2 id="analytics-title" className="text-xl font-semibold">
        Analytics
      </h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="sr-only">Unique Views</dt>
          <dd className="text-lg font-semibold">
            {summary.views} Unique Views
          </dd>
        </div>
        <div>
          <dt className="sr-only">Likes</dt>
          <dd className="text-lg font-semibold">{summary.likes} Likes</dd>
        </div>
        <div>
          <dt className="sr-only">Followers</dt>
          <dd className="text-lg font-semibold">
            {summary.followerCount} Followers
          </dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">{followerGrowthLabel}</p>
    </section>
  );
}
