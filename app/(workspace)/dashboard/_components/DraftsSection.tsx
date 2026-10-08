"use client";

import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EmptyState } from "@/components/web/EmptyState";
import { Button } from "@/components/ui/button";
import { DraftManagementRow } from "./DraftManagementRow";
import { DeletePostDialog } from "./DeletePostDialog";

export function DraftsSection() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const [selected, setSelected] = useState<{
    _id: Id<"posts">;
    title: string;
    sourcePostId?: Id<"posts">;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const deleteButtons = useRef(new Map<Id<"posts">, HTMLButtonElement>());
  const resumeLinks = useRef(new Map<Id<"posts">, HTMLAnchorElement>());
  const recoveryLink = useRef<HTMLAnchorElement>(null);
  const restoreTarget = useRef<HTMLElement | null>(null);
  const focusCandidates = useRef<Id<"posts">[] | null>(null);
  const deleteDraft = useMutation(api.posts.deleteDraft);
  const {
    results,
    status,
    loadMore,
    isLoading: listLoading,
  } = usePaginatedQuery(
    api.posts.getDrafts,
    !authLoading && isAuthenticated ? {} : "skip",
    {
      initialNumItems: 12,
    },
  );

  useEffect(() => {
    if (selected || focusCandidates.current === null) return;
    const target =
      focusCandidates.current
        .map((id) => resumeLinks.current.get(id))
        .find((link) => link?.isConnected) ?? recoveryLink.current;
    if (target) {
      restoreTarget.current = target;
      target.focus();
      focusCandidates.current = null;
    }
  }, [results, selected]);

  function restoreFocus() {
    const candidates = focusCandidates.current;
    const target = candidates
      ? (candidates
          .map((id) => resumeLinks.current.get(id))
          .find((link) => link?.isConnected) ?? recoveryLink.current)
      : restoreTarget.current;
    if (target?.isConnected) {
      target.focus();
      focusCandidates.current = null;
    }
  }

  async function handleDelete() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    const index = results.findIndex((draft) => draft._id === selected._id);
    const candidates = [
      ...results.slice(index + 1),
      ...results.slice(0, index).reverse(),
    ].map((draft) => draft._id);
    try {
      await deleteDraft({ draftId: selected._id });
      restoreTarget.current = null;
      focusCandidates.current = candidates;
      setSelected(null);
      toast.success("Draft deleted");
    } catch {
      setError("Could not delete this draft. Please try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (
    authLoading ||
    !isAuthenticated ||
    (listLoading && results.length === 0 && !selected)
  ) {
    return (
      <div className="flex justify-center py-12">
        <div role="status" aria-label="Loading drafts">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {results.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No drafts yet"
          description="Save an unfinished post and it will appear here."
          action={
            <Button asChild variant="outline">
              <Link ref={recoveryLink} href="/create">
                Create a post
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3 sm:gap-0 sm:overflow-hidden sm:rounded-xl sm:border sm:bg-card">
          {results.map((draft) => (
            <DraftManagementRow
              key={draft._id}
              draft={draft}
              deleting={pending && selected?._id === draft._id}
              resumeLinkRef={(node) => {
                if (node) resumeLinks.current.set(draft._id, node);
                else resumeLinks.current.delete(draft._id);
              }}
              deleteButtonRef={(node) => {
                if (node) deleteButtons.current.set(draft._id, node);
                else deleteButtons.current.delete(draft._id);
              }}
              onDelete={() => {
                restoreTarget.current =
                  deleteButtons.current.get(draft._id) ?? null;
                focusCandidates.current = null;
                setError(null);
                setSelected({
                  _id: draft._id,
                  title: draft.title.trim() || "Untitled draft",
                  sourcePostId: draft.sourcePostId,
                });
              }}
            />
          ))}
        </div>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
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
      <DeletePostDialog
        kind={selected?.sourcePostId ? "pending-update" : "draft"}
        title={selected?.title ?? ""}
        open={selected !== null}
        pending={pending}
        error={error}
        onCancel={() => {
          if (!inFlight.current) setSelected(null);
        }}
        onConfirm={() => void handleDelete()}
        onRestoreFocus={restoreFocus}
      />
    </div>
  );
}
