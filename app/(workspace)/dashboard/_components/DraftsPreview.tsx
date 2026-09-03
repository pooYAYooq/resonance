"use client";

import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import { FileText, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { DraftRow } from "./DraftRow";
import { DASHBOARD_PREVIEW_LIMIT } from "./previewConstants";

export function DraftsPreview() {
  const { results, isLoading: listLoading } = usePaginatedQuery(
    api.posts.getDrafts,
    {},
    { initialNumItems: DASHBOARD_PREVIEW_LIMIT },
  );

  if (listLoading && results.length === 0) {
    return (
      <div
        className="flex justify-center py-8"
        role="status"
        aria-label="Loading drafts"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section aria-labelledby="drafts-preview-title" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="drafts-preview-title" className="text-xl font-semibold">
          Continue Writing
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/drafts">View all drafts</Link>
        </Button>
      </div>
      {results.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No drafts yet"
          description="Start writing and unfinished ideas will appear here."
          action={
            <Button asChild variant="outline">
              <Link href="/create">Start writing</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {results.map((draft) => (
            <DraftRow key={draft._id} draft={draft} deleting={false} />
          ))}
        </div>
      )}
    </section>
  );
}
