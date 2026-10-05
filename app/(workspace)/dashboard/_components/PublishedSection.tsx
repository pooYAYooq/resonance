"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { Loader2, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/web/EmptyState";
import { PublishedRow } from "./PublishedRow";
import { DeletePostDialog } from "./DeletePostDialog";

export function PublishedSection() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const currentUser = useQuery(
    api.users.getCurrentUser,
    !authLoading && isAuthenticated ? {} : "skip",
  );
  const authorId = currentUser?.userId;
  const {
    results,
    status,
    loadMore,
    isLoading: listLoading,
  } = usePaginatedQuery(
    api.posts.getPostsByAuthorId,
    !authLoading && isAuthenticated && authorId ? { authorId } : "skip",
    { initialNumItems: 12 },
  );
  const deletePublishedPost = useMutation(api.posts.deletePublishedPost);
  const [selected, setSelected] = useState<{
    _id: Id<"posts">;
    title: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const deleteButtons = useRef(new Map<Id<"posts">, HTMLButtonElement>());
  const editLinks = useRef(new Map<Id<"posts">, HTMLAnchorElement>());
  const recoveryLink = useRef<HTMLAnchorElement>(null);
  const restoreTarget = useRef<HTMLElement | null>(null);
  const focusCandidates = useRef<Id<"posts">[] | null>(null);

  useEffect(() => {
    if (selected || focusCandidates.current === null) return;
    const target =
      focusCandidates.current
        .map((id) => editLinks.current.get(id))
        .find((link) => link?.isConnected) ?? recoveryLink.current;
    if (target) {
      // Close-autofocus may run after this effect; keep the same destination.
      restoreTarget.current = target;
      target.focus();
      focusCandidates.current = null;
    }
  }, [results, selected]);

  function restoreFocus() {
    const candidates = focusCandidates.current;
    const target = candidates
      ? (candidates
          .map((id) => editLinks.current.get(id))
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
    const index = results.findIndex((post) => post._id === selected._id);
    const candidates = [
      ...results.slice(index + 1),
      ...results.slice(0, index).reverse(),
    ].map((post) => post._id);
    try {
      await deletePublishedPost({ postId: selected._id });
      restoreTarget.current = null;
      focusCandidates.current = candidates;
      setSelected(null);
      toast.success("Post deleted");
    } catch {
      setError("Could not delete this post. Please try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (!currentUser || (listLoading && results.length === 0 && !selected)) {
    return (
      <div
        className="flex justify-center py-12"
        role="status"
        aria-label="Loading published posts"
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {results.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No published posts yet"
          description="Publish a draft or start a new post to share your work."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link ref={recoveryLink} href="/create">
                  New Post
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/drafts">View Drafts</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-3 sm:gap-0 sm:overflow-hidden sm:rounded-xl sm:border sm:bg-card">
          {results.map((post) => (
            <PublishedRow
              key={post._id}
              post={post}
              deleting={pending && selected?._id === post._id}
              editLinkRef={(node) => {
                if (node) editLinks.current.set(post._id, node);
                else editLinks.current.delete(post._id);
              }}
              deleteButtonRef={(node) => {
                if (node) deleteButtons.current.set(post._id, node);
                else deleteButtons.current.delete(post._id);
              }}
              onDelete={() => {
                restoreTarget.current =
                  deleteButtons.current.get(post._id) ?? null;
                focusCandidates.current = null;
                setError(null);
                setSelected({ _id: post._id, title: post.title });
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
