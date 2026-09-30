"use client";

import { AudioLines, CircleAlert, FileImage, Film } from "lucide-react";
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
  /** Replaces the status label when a state needs its own wording. */
  statusNote?: string;
};

export type MediaAuthoringProps = {
  inlineImages: readonly MediaAsset[];
  onReplaceMedia: (id: string) => void;
  onRemoveInline?: (id: string) => void;
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

function mediaTypeLabel(asset: MediaAsset) {
  return asset.mediaType === "audio"
    ? "Audio"
    : asset.mediaType === "video"
      ? "Video"
      : "Image";
}

function MediaThumbnail({ asset }: { asset: MediaAsset }) {
  const mediaType = asset.mediaType ?? "image";
  const Icon =
    mediaType === "audio" ? AudioLines : mediaType === "video" ? Film : null;

  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-md border bg-muted">
      {asset.url && mediaType === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.url}
          alt={asset.fileName ?? ""}
          data-testid="media-preview"
          className="size-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          data-testid="media-placeholder"
          className="flex size-full items-center justify-center text-muted-foreground"
        >
          {Icon ? <Icon className="size-6" /> : null}
        </span>
      )}
      <span className="absolute left-2 top-2 rounded bg-background/90 px-1.5 py-0.5 text-tiny font-medium text-muted-foreground shadow-sm">
        {asset.kind === "cover" ? "Cover" : "Inline"}
      </span>
    </div>
  );
}

function MediaCard({
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
    <article className="min-w-0" data-media-status={asset.status}>
      <MediaThumbnail asset={asset} />
      <div className="mt-2 min-w-0">
        <p className="truncate text-small font-medium">
          {asset.fileName ?? mediaTypeLabel(asset)}
        </p>
        {asset.fileName ? (
          <span className="sr-only">{mediaTypeLabel(asset)}</span>
        ) : null}
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-tiny",
            recoverable ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {recoverable ? (
            <CircleAlert className="size-3 shrink-0" aria-hidden="true" />
          ) : (
            <FileImage className="size-3 shrink-0" aria-hidden="true" />
          )}
          {asset.statusNote ?? statusLabel(asset)}
        </p>
        {recoverable ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
      </div>
    </article>
  );
}

export default function MediaAuthoring({
  inlineImages,
  onReplaceMedia,
  onRemoveInline,
}: MediaAuthoringProps) {
  const unresolved = inlineImages.some((asset) => asset.status !== "resolved");

  return (
    <section aria-label="Media authoring" className="grid gap-4">
      <div
        aria-label="Inline media"
        className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3"
      >
        {inlineImages.map((asset) => (
          <MediaCard
            key={asset.id}
            asset={asset}
            onReplace={() => onReplaceMedia(asset.id)}
            {...(onRemoveInline && {
              onRemove: () => onRemoveInline(asset.id),
            })}
          />
        ))}
      </div>

      {unresolved ? (
        <div role="status" aria-label="Review blocked until media is ready">
          Review blocked until media is ready
        </div>
      ) : null}
    </section>
  );
}
