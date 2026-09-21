import type { WritingSessionMedia } from "./useWritingSession";

export type CoverRecoveryState = "resolving" | "failed";

export type ReviewBlocker =
  | "failed-media"
  | "pending-media"
  | "cover-resolving"
  | "cover-load-failed";

export const REVIEW_BLOCKER_MESSAGES: Record<ReviewBlocker, string> = {
  "failed-media":
    "Some media failed to upload. Replace or remove it before publishing.",
  "pending-media":
    "Some media is still uploading. Wait for it to finish before publishing.",
  "cover-resolving":
    "Loading your saved cover. Review will be available when it finishes.",
  "cover-load-failed":
    "Your saved cover could not be loaded. Replace it or remove it to continue to Review.",
};

/**
 * The inline media reason that blocks entering Review. Failed media takes
 * priority over in-progress media so the author fixes the harder problem first.
 * A selected-but-unuploaded cover is uploaded by the submit flow itself, so it
 * does not block Review.
 */
export function getReviewBlocker(
  media: WritingSessionMedia,
): ReviewBlocker | null {
  if (media.failed.length > 0) return "failed-media";
  if (media.pending.length > 0) return "pending-media";
  return null;
}

/**
 * A recovered cover without a preview URL blocks Review until it resolves or
 * the author replaces or removes it. The stored cover intent is preserved, so
 * the block never silently drops it.
 */
export function getCoverRecoveryBlocker(
  state: CoverRecoveryState | null | undefined,
): ReviewBlocker | null {
  if (state === "resolving") return "cover-resolving";
  if (state === "failed") return "cover-load-failed";
  return null;
}

export type ReviewSubmitBlock =
  | "operation-in-flight"
  | "target-switching"
  | "media-not-ready";

/**
 * The pure submit guard for a Review submission. It is separate from button
 * disabling so it can be tested directly and so a race between render and click
 * cannot submit an incomplete post.
 */
export function getReviewSubmitBlock(input: {
  isPending: boolean;
  hasPendingTarget: boolean;
  blocker: ReviewBlocker | null;
}): ReviewSubmitBlock | null {
  if (input.isPending) return "operation-in-flight";
  if (input.hasPendingTarget) return "target-switching";
  if (input.blocker) return "media-not-ready";
  return null;
}
