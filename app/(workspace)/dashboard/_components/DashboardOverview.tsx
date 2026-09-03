"use client";

import { DraftsPreview } from "./DraftsPreview";
import { PublishedPreview } from "./PublishedPreview";

export function DashboardOverview() {
  return (
    <div className="space-y-10">
      <h2 className="sr-only">Your writing workspace</h2>
      <DraftsPreview />
      <PublishedPreview />
    </div>
  );
}
