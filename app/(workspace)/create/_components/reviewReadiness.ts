import type { WritingSessionMedia } from "./useWritingSession";

export type ReviewBlocker = "failed-media" | "pending-media";

export const REVIEW_BLOCKER_MESSAGES: Record<ReviewBlocker, string> = {
  "failed-media":
    "Some media failed to upload. Retry or remove it in Post details before reviewing.",
  "pending-media":
    "Some media is still uploading. Wait for it to finish before reviewing.",
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
