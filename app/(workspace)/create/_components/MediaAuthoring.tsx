"use client";

export type MediaKind = "inline" | "cover";
export type MediaStatus =
  | "choosing"
  | "uploading"
  | "finalizing"
  | "resolved"
  | "failed"
  | "expired";

export type MediaAsset = {
  id: string;
  kind: MediaKind;
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
  onRetry: (id: string) => void;
  coverInputAriaLabel?: string;
};

function statusLabel(asset: MediaAsset) {
  switch (asset.status) {
    case "choosing":
      return "Ready to upload";
    case "uploading":
      return "Uploading";
    case "finalizing":
      return "Finalizing";
    case "failed":
      return asset.error ?? "Upload failed";
    case "expired":
      return "This image expired";
    case "resolved":
      return "Ready";
  }
}

function MediaStatusView({
  asset,
  onRetry,
}: {
  asset: MediaAsset;
  onRetry: () => void;
}) {
  const recoverable = asset.status === "failed" || asset.status === "expired";

  return (
    <span
      className="flex items-center gap-2 text-sm"
      data-media-status={asset.status}
    >
      {asset.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.url}
          alt={asset.fileName ?? ""}
          data-testid="media-preview"
          className="size-12 rounded border object-cover"
        />
      ) : null}
      <span>{statusLabel(asset)}</span>
      {recoverable ? (
        <button type="button" onClick={onRetry}>
          {asset.status === "failed" ? "Retry failed" : "Retry expired"}
        </button>
      ) : null}
    </span>
  );
}

export default function MediaAuthoring({
  inlineImages,
  cover,
  onChooseCover,
  onRemoveCover,
  onRetry,
  coverInputAriaLabel,
}: MediaAuthoringProps) {
  const unresolved = inlineImages.some((asset) => asset.status !== "resolved");

  return (
    <section aria-label="Media authoring" className="grid gap-4">
      <div className="grid gap-3" aria-label="Inline media">
        {inlineImages.map((asset) => (
          <article key={asset.id}>
            <MediaStatusView asset={asset} onRetry={() => onRetry(asset.id)} />
          </article>
        ))}
      </div>

      <div className="grid gap-2" aria-label="Cover media">
        {cover ? (
          <MediaStatusView asset={cover} onRetry={() => onRetry(cover.id)} />
        ) : null}
        <label>
          {cover ? "Replace cover image" : "Add cover image"}
          <input
            type="file"
            accept="image/*"
            aria-label={
              coverInputAriaLabel ??
              (cover ? "Replace cover image" : "Add cover image")
            }
            onClick={(event) => {
              // Clear before opening the picker so choosing the same file
              // still emits a change event without losing the selected value.
              event.currentTarget.value = "";
            }}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onChooseCover(file);
            }}
          />
        </label>
        {cover ? (
          <button type="button" onClick={onRemoveCover}>
            Remove cover
          </button>
        ) : null}
      </div>

      {unresolved ? (
        <div role="status" aria-label="Review blocked until media is ready">
          Review blocked until media is ready
        </div>
      ) : null}
    </section>
  );
}
