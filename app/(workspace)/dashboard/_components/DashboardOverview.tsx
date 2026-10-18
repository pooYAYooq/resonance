"use client";

import { WelcomeDialog } from "@/components/web/WelcomeDialog";
import { DraftsPreview } from "./DraftsPreview";
import { PublishedPreview } from "./PublishedPreview";

export function DashboardOverview() {
  return (
    <div className="space-y-10">
      <WelcomeDialog />
      <h2 className="sr-only">Your writing workspace</h2>
      <DraftsPreview />
      <PublishedPreview />
    </div>
  );
}
