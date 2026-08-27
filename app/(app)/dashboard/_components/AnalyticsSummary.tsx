"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { FollowerGrowthChart } from "./FollowerGrowthChart";

export function AnalyticsSummary() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [asOf, setAsOf] = useState(() => Date.now());

  useEffect(() => {
    // Calculate milliseconds until next UTC midnight
    const now = Date.now();
    const nextMidnight = new Date(now);
    nextMidnight.setUTCHours(24, 0, 0, 0);
    const msUntilMidnight = nextMidnight.getTime() - now;

    const timer = setTimeout(() => {
      setAsOf(Date.now());
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, [asOf]);

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

  const followerGrowth = summary.followerGrowthDays.reduce(
    (total, day) => total + day.gainedCount,
    0,
  );

  return (
    <section aria-labelledby="analytics-title" className="flex flex-col gap-4">
      <h2 id="analytics-title" className="text-xl font-semibold">
        Analytics
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Unique Views</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.views}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Likes Received</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.likes}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current Followers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.followerCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New Followers (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {followerGrowth}
          </CardContent>
        </Card>
      </div>
      <FollowerGrowthChart points={summary.followerGrowthDays} />
    </section>
  );
}
