"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EmptyState } from "@/components/web/EmptyState";
import { Button } from "@/components/ui/button";
import { DraftRow } from "./DraftRow";

export function DraftsSection() {
  const [deletingId, setDeletingId] = useState<Id<"posts">>();
  const deleteDraft = useMutation(api.posts.deleteDraft);
  const {
    results,
    status,
    loadMore,
    isLoading: listLoading,
  } = usePaginatedQuery(api.posts.getDrafts, {}, {
    initialNumItems: 12,
  });

  if (listLoading && results.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div role="status" aria-label="Loading drafts">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!listLoading && results.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No drafts yet"
        description="Save an unfinished post and it will appear here."
        action={
          <Button asChild variant="outline">
            <Link href="/create">Create a post</Link>
          </Button>
        }
      />
    );
  }

  async function handleDelete(draftId: Id<"posts">) {
    if (!window.confirm("Delete this draft?")) return;
    setDeletingId(draftId);
    try {
      await deleteDraft({ draftId });
      toast.success("Draft deleted");
    } catch {
      toast.error("Failed to delete draft");
    } finally {
      setDeletingId(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {results.map((draft) => (
          <DraftRow
            key={draft._id}
            draft={draft}
            deleting={deletingId === draft._id}
            onDelete={() => void handleDelete(draft._id)}
          />
        ))}
      </div>
      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => loadMore(12)}
            disabled={listLoading}
          >
            {listLoading ? "Loading more..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
