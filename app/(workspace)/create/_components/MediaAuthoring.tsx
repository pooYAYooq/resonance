"use client";

import { useRef } from "react";
import { AudioLines, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MediaKind = "inline" | "cover";
export type MediaType = "image" | "audio" | "video";
export type MediaStatus =
  | "choosing"
  | "uploading"
  | "finalizing"
  | "resolved"
  | "failed";

export type MediaAsset = {
  id: string;
  kind: MediaKind;
  mediaType?: MediaType;
  status: MediaStatus;
  url?: string;
  error?: string;
  fileName?: string;
};

export type MediaAuthoringProps = {
  inlineImages: readonly MediaAsset[];
  cover: MediaAsset | null;
  onChooseCover: (file: File) => void;
  onRemoveCover: () => void;
  onReplaceMedia: (id: string) => void;
  onRemoveInline?: (id: string) => void;
  coverInputAriaLabel?: string;
  coverNote?: string;
};

const STATUS_LABELS: Record<Exclude<MediaStatus, "failed">, string> = {
  choosing: "Selected",
  uploading: "Uploading...",
  finalizing: "Finishing upload...",
  resolved: "Ready to publish",
};

const ACTION_BUTTON_CLASS =
  "cursor-pointer hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent";

function statusLabel(asset: MediaAsset) {
  return asset.status === "failed"
    ? (asset.error ?? "Upload failed")
    : STATUS_LABELS[asset.status];
}

function MediaThumbnail({ asset }: { asset: MediaAsset }) {
  const mediaType = asset.mediaType ?? "image";
  if (asset.url && mediaType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.url}
        alt={asset.fileName ?? ""}
        data-testid="media-preview"
        className="size-16 shrink-0 rounded border object-cover"
      />
    );
  }
  const Icon =
    mediaType === "audio" ? AudioLines : mediaType === "video" ? Film : null;
  return (
    <span
      aria-hidden="true"
      data-testid="media-placeholder"
      className="flex size-16 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground"
    >
      {Icon ? <Icon className="size-6" /> : null}
    </span>
  );
}

function MediaRow({
  asset,
  onReplace,
  onRemove,
}: {
  asset: MediaAsset;
  onReplace: () => void;
  onRemove?: () => void;
}) {
  const recoverable = asset.status === "failed";
  return (
    <article
      className="flex items-center gap-3"
      data-media-status={asset.status}
    >
      <MediaThumbnail asset={asset} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {asset.kind === "cover" ? "Cover" : "Inline"}
          </span>
          {asset.fileName ? (
            <span className="truncate">{asset.fileName}</span>
          ) : null}
        </div>
        <p
          className={cn(
            "text-sm",
            recoverable ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {statusLabel(asset)}
        </p>
      </div>
      {recoverable ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ACTION_BUTTON_CLASS}
            onClick={onReplace}
          >
            Replace
          </Button>
          {onRemove ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={ACTION_BUTTON_CLASS}
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function MediaAuthoring({
  inlineImages,
  cover,
  onChooseCover,
  onRemoveCover,
  onReplaceMedia,
  onRemoveInline,
  coverInputAriaLabel,
  coverNote,
}: MediaAuthoringProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const unresolved = inlineImages.some((asset) => asset.status !== "resolved");
  const openCoverPicker = () => coverInputRef.current?.click();

  return (
    <section aria-label="Media authoring" className="grid gap-4">
      <div className="grid gap-3" aria-label="Inline media">
        {inlineImages.map((asset) => (
          <article key={asset.id}>
            <MediaRow
              asset={asset}
              onReplace={() => onReplaceMedia(asset.id)}
              {...(onRemoveInline && {
                onRemove: () => onRemoveInline(asset.id),
              })}
            />
          </article>
        ))}
      </div>

      <div className="grid gap-3" aria-label="Cover media">
        {cover ? <MediaRow asset={cover} onReplace={openCoverPicker} /> : null}
        {cover ? (
          <div className="flex items-center gap-2">
            <Button
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
              onClick={onRemoveCover}
            >
              Remove cover
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              No cover selected. Your post will show without a cover image.
            </p>
            <Button
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
        {cover?.status === "choosing" && coverNote ? (
          <p className="text-sm text-muted-foreground">{coverNote}</p>
        ) : null}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
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
      </div>

      {unresolved ? (
        <div role="status" aria-label="Review blocked until media is ready">
          Review blocked until media is ready
        </div>
      ) : null}
    </section>
  );
}
