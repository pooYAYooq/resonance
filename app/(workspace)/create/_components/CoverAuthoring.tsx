"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Image as ImageIcon } from "lucide-react";
import { POST_COVER_ASPECT } from "@/components/web/PostCover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "./MediaAuthoring";
import {
  REVIEW_BLOCKER_MESSAGES,
  type CoverRecoveryState,
} from "./reviewReadiness";

type CoverAuthoringProps = {
  cover: MediaAsset | null;
  onChooseCover: (file: File) => void;
  onRemoveCover: () => void;
  coverInputAriaLabel?: string;
  coverNote?: string;
  coverRecovery?: CoverRecoveryState | null;
  guidanceId?: string;
  actionRef?: React.RefObject<HTMLButtonElement | null>;
};

const ACTION_BUTTON_CLASS =
  "cursor-pointer hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent";

/**
 * The cover picker above the title: an empty dropzone, a live published-ratio
 * preview of the selected or saved cover, and the replace/remove actions with their
 * lifecycle and recovery notes.
 */
export default function CoverAuthoring({
  cover,
  onChooseCover,
  onRemoveCover,
  coverInputAriaLabel,
  coverNote,
  coverRecovery,
  guidanceId,
  actionRef,
}: CoverAuthoringProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const localActionRef = useRef<HTMLButtonElement>(null);
  const primaryActionRef = actionRef ?? localActionRef;
  const removedActionRef = useRef<HTMLButtonElement | null>(null);
  const generatedHelpId = useId();
  const helpId = guidanceId ?? generatedHelpId;
  const [dragging, setDragging] = useState(false);
  const openCoverPicker = () => coverInputRef.current?.click();
  const failed = coverRecovery === "failed";
  const describedBy = failed ? `${helpId} ${helpId}-error` : helpId;
  useLayoutEffect(() => {
    const removed = removedActionRef.current;
    if (!removed) return;
    removedActionRef.current = null;
    if (!removed.isConnected && document.activeElement === document.body) {
      primaryActionRef.current?.focus();
    }
  });
  const removeCover = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (document.activeElement === event.currentTarget) {
      removedActionRef.current = event.currentTarget;
    }
    onRemoveCover();
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) onChooseCover(file);
  };
  const statusLine =
    coverRecovery === "resolving"
      ? REVIEW_BLOCKER_MESSAGES["cover-resolving"]
      : cover?.status === "choosing" && coverNote
        ? coverNote
        : cover?.statusNote;

  return (
    <section aria-label="Cover" className="flex flex-col gap-3">
      <p
        id={helpId}
        role="status"
        aria-atomic="true"
        className="text-sm text-muted-foreground"
      >
        {!cover && !failed
          ? "A cover is required to publish. You can save a draft without one."
          : (statusLine ?? "A cover is required to publish.")}
      </p>
      {failed ? (
        <>
          <p
            id={`${helpId}-error`}
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm"
          >
            {REVIEW_BLOCKER_MESSAGES["cover-load-failed"]}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              ref={primaryActionRef}
              aria-describedby={describedBy}
              type="button"
              variant="outline"
              size="sm"
              className={ACTION_BUTTON_CLASS}
              onClick={openCoverPicker}
            >
              Replace cover
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={ACTION_BUTTON_CLASS}
              onClick={removeCover}
            >
              Remove cover
            </Button>
          </div>
        </>
      ) : cover ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className={cn(
              POST_COVER_ASPECT,
              "relative w-full max-w-md overflow-hidden rounded-lg border bg-muted sm:w-80 sm:flex-none",
            )}
          >
            {cover.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover.url}
                alt={cover.fileName ?? "Cover preview"}
                data-testid="media-preview"
                className="size-full object-cover"
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {cover.fileName ? (
              <p className="truncate text-base">{cover.fileName}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                ref={primaryActionRef}
                aria-describedby={describedBy}
                type="button"
                variant="outline"
                size="sm"
                className={ACTION_BUTTON_CLASS}
                onClick={openCoverPicker}
              >
                Replace cover
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={ACTION_BUTTON_CLASS}
                onClick={removeCover}
              >
                Remove cover
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-wrap items-center gap-4 rounded-lg border border-dashed px-4 py-3 transition-colors",
            dragging ? "border-ring bg-accent/40" : "border-border bg-muted/30",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDragging(false);
            }
          }}
          onDrop={handleDrop}
        >
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
          >
            <ImageIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base">No cover selected</p>
          </div>
          <Button
            ref={primaryActionRef}
            aria-describedby={describedBy}
            type="button"
            variant="outline"
            size="sm"
            className={ACTION_BUTTON_CLASS}
            onClick={openCoverPicker}
          >
            Add cover
          </Button>
        </div>
      )}

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-describedby={describedBy}
        className="sr-only"
        aria-label={
          coverInputAriaLabel ??
          (cover ? "Replace cover image" : "Add cover image")
        }
        onClick={(event) => {
          // Clear before opening the picker so choosing the same file still
          // emits a change event without losing the selected value.
          event.currentTarget.value = "";
        }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onChooseCover(file);
        }}
      />
    </section>
  );
}
