import type { BlockNoteDocument } from "@/lib/post-content";
import type { CanonicalProposal } from "@/lib/write-contract";

export type CoverIntent =
  | { kind: "default" }
  | { kind: "removed" }
  | { kind: "existing"; storageId: string }
  | { kind: "new"; file: File };

export type ReviewedInlineImage = { storageId: string; url: string };

export type ReviewedSnapshot = {
  title: string;
  body: string;
  tags: string[];
  cover: CoverIntent;
  coverPreviewUrl?: string;
  inlineImages: ReviewedInlineImage[];
};

export type CoverState = {
  selectedFile?: File;
  existingStorageId?: string;
  removed: boolean;
};

export type ReviewPreview = {
  coverPreviewUrl?: string;
  inlineImages: ReviewedInlineImage[];
};

/** What a submission needs, independent of whether it came from the live form
 * or from the reviewed snapshot. */
export type ReviewSubmission = {
  title: string;
  body: string;
  content: BlockNoteDocument;
  tags: string[];
  coverFile?: File;
  existingCoverStorageId?: string;
};

/**
 * Resolves the reviewed cover intent. A newly selected file wins, then an
 * explicit removal, then an existing stored cover, then the display default.
 */
export function resolveCoverIntent(cover: CoverState): CoverIntent {
  if (cover.selectedFile) return { kind: "new", file: cover.selectedFile };
  if (cover.removed) return { kind: "removed" };
  if (cover.existingStorageId) {
    return { kind: "existing", storageId: cover.existingStorageId };
  }
  return { kind: "default" };
}

/**
 * Captures the exact content, cover, and media the author reviewed, so Review
 * renders and submits only this snapshot rather than live form state.
 */
export function captureReviewedSnapshot(
  proposal: CanonicalProposal,
  cover: CoverState,
  preview: ReviewPreview,
): ReviewedSnapshot {
  return {
    title: proposal.title,
    body: proposal.body,
    tags: [...proposal.tags],
    cover: resolveCoverIntent(cover),
    ...(preview.coverPreviewUrl && {
      coverPreviewUrl: preview.coverPreviewUrl,
    }),
    inlineImages: preview.inlineImages.map((image) => ({ ...image })),
  };
}

/** Builds a validated-at-submit submission from a reviewed snapshot. */
export function buildSnapshotSubmission(
  snapshot: ReviewedSnapshot,
): ReviewSubmission {
  return {
    title: snapshot.title,
    body: snapshot.body,
    content: JSON.parse(snapshot.body) as BlockNoteDocument,
    tags: [...snapshot.tags],
    ...(snapshot.cover.kind === "new" && { coverFile: snapshot.cover.file }),
    ...(snapshot.cover.kind === "existing" && {
      existingCoverStorageId: snapshot.cover.storageId,
    }),
  };
}
