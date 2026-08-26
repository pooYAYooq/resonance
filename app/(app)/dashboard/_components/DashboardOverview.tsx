"use client";

import { AnalyticsSummary } from "./AnalyticsSummary";
import { DraftsPreview } from "./DraftsPreview";
import { PublishedPreview } from "./PublishedPreview";
import { SavedPreview } from "./SavedPreview";

export function DashboardOverview() {
  return (
    <div className="space-y-10">
      <h2 className="sr-only">Your writing workspace</h2>
      <AnalyticsSummary />
      <DraftsPreview />
      <PublishedPreview />
      <SavedPreview />
    </div>
  );
}
