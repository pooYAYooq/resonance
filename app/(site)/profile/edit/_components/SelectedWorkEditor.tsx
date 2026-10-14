/**
 * Selected-work editor for `/profile/edit`.
 *
 * Authors choose up to nine of their own published posts and order them. The
 * picker is a bounded, debounced, newest-first browse of the author's own
 * published titles (`listOwnPublishedPosts`); the chosen list keeps a small
 * card cache so search and pagination changes never erase chosen titles.
 *
 * Selection state is independent of identity state: its own baseline, pending,
 * and conflict flags. A live revision change adopts a clean form's newest saved
 * order, but a dirty form keeps its local order and additions and asks for an
 * explicit Reload. A bounded availability subscription removes only entries the
 * server confirms are gone, so another session's reorder is never mistaken for
 * a deletion.
 */

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CoverImage } from "@/components/web/CoverImage";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  cacheSelectedCards,
  initialEditState,
  markConflict,
  moveSelected,
  receiveSaved,
  reconcileSaved,
  type EditState,
} from "./profileEditState";
import type { ProfileEditSaveStatus } from "./profileEditSave";

const MAX_SELECTED = 9;
const PICKER_PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 250;
const MAX_SEARCH_CODE_POINTS = 100;

export type SelectedWorkCard = {
  postId: Id<"posts">;
  title: string;
  imageUrl: string | null;
  likeCount: number;
};

export type SelectedWorkEditorProps = {
  selectedPostIds: Id<"posts">[];
  selectedPosts: SelectedWorkCard[];
  selectionRevision: number;
  saveRequest: number;
  onSaveStateChange: (status: ProfileEditSaveStatus) => void;
};

function idsEqual(
  a: readonly Id<"posts">[],
  b: readonly Id<"posts">[],
): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function SelectedWorkEditor({
  selectedPostIds,
  selectedPosts,
  selectionRevision,
  saveRequest,
  onSaveStateChange,
}: SelectedWorkEditorProps) {
  const updateSelection = useMutation(api.profiles.updateSelection);
  const [state, setState] = useState<EditState<Id<"posts">[]>>(() =>
    initialEditState(selectedPostIds, selectionRevision),
  );
  const [processedRevision, setProcessedRevision] = useState(selectionRevision);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const removeRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<Id<"posts"> | "empty" | null>(null);
  const [cards, setCards] = useState<Record<string, SelectedWorkCard>>(() =>
    cacheSelectedCards({}, selectedPostIds, selectedPosts),
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const pickerSearchRef = useRef<HTMLInputElement>(null);
  const pickerPostRefs = useRef(new Map<string, HTMLButtonElement>());
  const pickerDialogRef = useRef<HTMLDivElement>(null);
  const pickerDoneRef = useRef<HTMLButtonElement>(null);
  const paginationRequest = useRef<{
    control: HTMLButtonElement;
    count: number;
  } | null>(null);
  const handledSaveRequest = useRef(saveRequest);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");

  useEffect(() => {
    if (searchInput === committedSearch) return;
    const handle = setTimeout(
      () => setCommittedSearch(searchInput),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(handle);
  }, [searchInput, committedSearch]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.profiles.listOwnPublishedPosts,
    { search: committedSearch },
    { initialNumItems: PICKER_PAGE_SIZE },
  );

  useEffect(() => {
    const request = paginationRequest.current;
    if (!request || status === "LoadingMore" || status === "LoadingFirstPage")
      return;
    paginationRequest.current = null;
    const active = document.activeElement;
    if (
      active !== request.control &&
      active !== document.body &&
      active !== pickerDialogRef.current
    )
      return;
    const available = results
      .slice(request.count)
      .map((entry) => pickerPostRefs.current.get(entry.postId))
      .find((button) => button && !button.disabled);
    if (available) available.focus();
    else if (request.control.isConnected) request.control.focus();
    else {
      const last = results
        .map((entry) => pickerPostRefs.current.get(entry.postId))
        .filter((button) => button && !button.disabled)
        .at(-1);
      (last ?? pickerDoneRef.current)?.focus();
    }
  }, [results, status]);

  // Retain only the at-most-nine chosen cards across searches, refreshing their
  // summaries when the saved selection or current results update.
  useEffect(() => {
    setCards((previous) =>
      cacheSelectedCards(previous, state.value, [...selectedPosts, ...results]),
    );
  }, [state.value, results, selectedPosts]);

  // A newer saved revision: a clean form adopts it, a dirty form keeps its work.
  // Reconcile the submitted baseline first when its query echo beats the
  // mutation response, including a newer local revert to the old order.
  if (selectionRevision !== processedRevision && !pending) {
    setProcessedRevision(selectionRevision);
    setState((current) =>
      receiveSaved(current, selectedPostIds, selectionRevision, idsEqual),
    );
  }

  const localIds = state.value;
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    if (target === "empty") pickerTriggerRef.current?.focus();
    else removeRefs.current.get(target)?.focus();
  }, [localIds]);
  const availabilityKey = localIds.join(",");
  const availability = useQuery(
    api.profiles.getOwnSelectionAvailability,
    localIds.length > 0 ? { postIds: localIds } : "skip",
  );
  const [resolvedAvailability, setResolvedAvailability] = useState<{
    key: string;
    ids: string[];
  } | null>(null);

  // Only trust a resolved result for the exact argument list it was requested
  // with, and refresh it when the reactive result changes; discard anything
  // stale so a pending/changed subscription is never read as a deletion.
  if (availability !== undefined) {
    const ids = availability.map((entry) => entry.postId);
    if (
      resolvedAvailability === null ||
      resolvedAvailability.key !== availabilityKey ||
      resolvedAvailability.ids.join(",") !== ids.join(",")
    ) {
      setResolvedAvailability({ key: availabilityKey, ids });
    }
  }

  if (localIds.length > 0 && resolvedAvailability?.key === availabilityKey) {
    const present = new Set(resolvedAvailability.ids);
    if (localIds.some((id) => !present.has(id))) {
      setState((current) => ({
        ...current,
        value: current.value.filter((id) => present.has(id)),
        baseline: current.baseline.filter((id) => present.has(id)),
      }));
    }
  }

  function handlePickerArrow(
    event: KeyboardEvent<HTMLElement>,
    postId: Id<"posts"> | null,
  ) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    )
      return;

    const direction =
      event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowUp" && postId !== null
          ? -1
          : null;
    if (direction === null) return;

    const buttons = results
      .map((entry) => pickerPostRefs.current.get(entry.postId))
      .filter((button): button is HTMLButtonElement =>
        Boolean(button && !button.disabled),
      );
    if (buttons.length === 0) return;
    const index =
      postId === null
        ? -1
        : buttons.findIndex(
            (button) => button === pickerPostRefs.current.get(postId),
          );
    if (postId !== null && index < 0) return;

    event.preventDefault();
    if (index === 0 && direction === -1) pickerSearchRef.current?.focus();
    else buttons[index + direction]?.focus();
  }

  function selectPost(entry: SelectedWorkCard) {
    const selected = state.value.includes(entry.postId);
    if (!selected && state.value.length >= MAX_SELECTED) return;
    const nextIds = selected
      ? state.value.filter((id) => id !== entry.postId)
      : [...state.value, entry.postId];
    setCards((previous) => cacheSelectedCards(previous, nextIds, [entry]));
    setState((current) => {
      if (current.value.includes(entry.postId)) {
        return {
          ...current,
          value: current.value.filter((id) => id !== entry.postId),
        };
      }
      if (current.value.length >= MAX_SELECTED) return current;
      return { ...current, value: [...current.value, entry.postId] };
    });
  }

  function removePost(postId: Id<"posts">) {
    const index = state.value.indexOf(postId);
    const remaining = state.value.filter((id) => id !== postId);
    pendingFocus.current =
      remaining[Math.min(index, remaining.length - 1)] ?? "empty";
    setState((current) => ({
      ...current,
      value: current.value.filter((id) => id !== postId),
    }));
  }

  function movePost(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= state.value.length) return;
    const movedTitle = cards[state.value[index]]?.title ?? "Post";
    setStatusMessage(
      `${movedTitle} moved to position ${target + 1} of ${state.value.length}.`,
    );
    setState((current) => {
      const nextValue = moveSelected(current.value, index, target);
      return { ...current, value: nextValue };
    });
  }

  function handleReload() {
    setState(initialEditState(selectedPostIds, selectionRevision));
    setProcessedRevision(selectionRevision);
    setSaveError(null);
  }

  const handleSave = useCallback(async () => {
    if (pending || idsEqual(state.value, state.baseline) || state.conflict)
      return;
    setSaveError(null);
    setPending(true);
    const submitted = state.value;
    try {
      const result = await updateSelection({
        expectedRevision: state.revision,
        postIds: submitted,
      });
      if (!mounted.current) return;
      if (result.kind === "saved") {
        setState((current) =>
          reconcileSaved(current, submitted, result.revision),
        );
        toast.success("Featured posts saved");
        return;
      }
      setState(markConflict);
    } catch {
      if (!mounted.current) return;
      setSaveError("Could not save your featured posts. Try again.");
    } finally {
      if (mounted.current) setPending(false);
    }
  }, [
    pending,
    state.baseline,
    state.conflict,
    state.revision,
    state.value,
    updateSelection,
  ]);

  const dirty = !idsEqual(state.value, state.baseline);
  const atCapacity = state.value.length >= MAX_SELECTED;

  useEffect(() => {
    onSaveStateChange({
      dirty,
      pending,
      conflict: state.conflict,
    });
  }, [dirty, pending, state.conflict, onSaveStateChange]);

  useEffect(() => {
    if (handledSaveRequest.current === saveRequest) return;
    handledSaveRequest.current = saveRequest;
    if (dirty && !pending && !state.conflict) void handleSave();
  }, [saveRequest, dirty, pending, state.conflict, handleSave]);

  return (
    <Dialog
      open={pickerOpen}
      onOpenChange={(open) => {
        if (!open) paginationRequest.current = null;
        setPickerOpen(open);
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-lg font-semibold">Featured posts</h2>
            <p className="text-sm text-muted-foreground">
              {state.value.length} of {MAX_SELECTED} selected
            </p>
          </div>
          <DialogTrigger asChild>
            <Button
              ref={pickerTriggerRef}
              type="button"
              variant="outline"
              className="cursor-pointer"
            >
              <Plus data-icon="inline-start" />
              {atCapacity
                ? "Manage posts"
                : state.value.length === 0
                  ? "Choose posts"
                  : "Add posts"}
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent
          ref={pickerDialogRef}
          showCloseButton={false}
          aria-describedby={undefined}
          className="flex h-[85dvh] max-h-[640px] flex-col overflow-hidden sm:max-w-2xl"
          onInteractOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            pickerTriggerRef.current?.focus({ preventScroll: true });
          }}
        >
          <DialogHeader className="shrink-0">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <DialogTitle>Choose posts</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {state.value.length} of {MAX_SELECTED} selected
              </p>
            </div>
          </DialogHeader>
          <Field className="shrink-0">
            <Input
              ref={pickerSearchRef}
              id="selected-work-search"
              aria-label="Search posts"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(
                  Array.from(event.target.value)
                    .slice(0, MAX_SEARCH_CODE_POINTS)
                    .join(""),
                )
              }
              placeholder="Search by title"
              onKeyDown={(event) => handlePickerArrow(event, null)}
            />
          </Field>

          <div
            role="region"
            aria-label="Published post picker"
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain"
          >
            {results.length === 0 && status === "Exhausted" && (
              <p className="text-sm text-muted-foreground">
                {committedSearch.length > 0
                  ? "No published posts match that title."
                  : "You have no published posts yet."}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {results.map((entry) => {
                const selected = state.value.includes(entry.postId);
                return (
                  <li key={entry.postId}>
                    <Button
                      ref={(node) => {
                        if (node)
                          pickerPostRefs.current.set(entry.postId, node);
                        else pickerPostRefs.current.delete(entry.postId);
                      }}
                      type="button"
                      variant={selected ? "secondary" : "outline"}
                      className="h-auto w-full justify-start gap-3 py-2"
                      aria-pressed={selected}
                      disabled={!selected && atCapacity}
                      onClick={() => selectPost(entry)}
                      onKeyDown={(event) =>
                        handlePickerArrow(event, entry.postId)
                      }
                    >
                      <span className="relative aspect-[3/2] w-16 shrink-0 overflow-hidden rounded bg-muted">
                        <CoverImage
                          src={entry.imageUrl}
                          alt=""
                          sizes="64px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1 whitespace-normal break-words text-left">
                        {entry.title}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
            {status === "LoadingFirstPage" && (
              <p className="text-sm text-muted-foreground">
                Loading your posts…
              </p>
            )}
            {(status === "CanLoadMore" || status === "LoadingMore") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-disabled={status === "LoadingMore"}
                className="aria-disabled:opacity-50"
                onBlur={(event) => {
                  if (event.relatedTarget && event.currentTarget.isConnected)
                    paginationRequest.current = null;
                }}
                onClick={(event) => {
                  if (status !== "CanLoadMore" || paginationRequest.current)
                    return;
                  if (document.activeElement === event.currentTarget) {
                    paginationRequest.current = {
                      control: event.currentTarget,
                      count: results.length,
                    };
                  }
                  loadMore(PICKER_PAGE_SIZE);
                }}
              >
                {status === "LoadingMore" ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button
              ref={pickerDoneRef}
              type="button"
              className="w-full cursor-pointer"
              onClick={() => setPickerOpen(false)}
            >
              <Check data-icon="inline-start" />
              Done
            </Button>
          </DialogFooter>
        </DialogContent>

        <div className="flex flex-col gap-3">
          {state.value.length > 0 && (
            <ul className="flex flex-col gap-2">
              {state.value.map((postId, index) => {
                const title = cards[postId]?.title ?? "Post";
                return (
                  <li
                    key={postId}
                    className="flex min-w-0 flex-col gap-2 rounded-md border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="relative aspect-[3/2] w-16 shrink-0 overflow-hidden rounded bg-muted">
                        <CoverImage
                          src={cards[postId]?.imageUrl}
                          alt=""
                          sizes="64px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1 break-words text-sm">
                        {index + 1}. {title}
                      </span>
                    </div>
                    <div
                      role="group"
                      aria-label={`Arrange ${title}`}
                      className="inline-flex w-fit items-center rounded-lg border bg-card p-0.5"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Move ${title} up`}
                        aria-disabled={index === 0}
                        className="min-h-8 w-14 cursor-pointer rounded-md hover:bg-transparent! hover:text-management-edit aria-disabled:opacity-50"
                        onClick={() => movePost(index, -1)}
                      >
                        Up
                      </Button>
                      <Separator orientation="vertical" className="my-1.5" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Move ${title} down`}
                        aria-disabled={index === state.value.length - 1}
                        className="min-h-8 w-14 cursor-pointer rounded-md hover:bg-transparent! hover:text-management-edit aria-disabled:opacity-50"
                        onClick={() => movePost(index, 1)}
                      >
                        Down
                      </Button>
                      <Separator orientation="vertical" className="my-1.5" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${title}`}
                        className="min-h-8 w-20 cursor-pointer rounded-md hover:bg-transparent! hover:text-destructive"
                        ref={(node) => {
                          if (node) removeRefs.current.set(postId, node);
                          else removeRefs.current.delete(postId);
                        }}
                        onClick={() => removePost(postId)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p role="status" aria-live="polite" className="sr-only">
            {statusMessage}
          </p>

          {state.conflict && (
            <div role="alert" className="text-sm text-destructive">
              <p>
                Your featured posts changed elsewhere. Load the saved version to
                replace your changes.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleReload}
              >
                Load saved version
              </Button>
            </div>
          )}

          <div className="min-h-5">
            {saveError && <FieldError>{saveError}</FieldError>}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
