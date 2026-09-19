export const MAX_INLINE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_BLOCKNOTE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_INLINE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Type guard to check if a content type is an allowed inline image type.
 *
 * @param contentType - The content type to check
 * @returns True if the content type is JPEG, PNG, or WebP
 */
export function isAllowedInlineImageType(
  contentType: string | undefined,
): contentType is (typeof ALLOWED_INLINE_IMAGE_TYPES)[number] {
  return (
    contentType !== undefined &&
    (ALLOWED_INLINE_IMAGE_TYPES as readonly string[]).includes(contentType)
  );
}

export const ALLOWED_BLOCKNOTE_AUDIO_TYPES = [
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
] as const;

export const ALLOWED_BLOCKNOTE_VIDEO_TYPES = [
  "video/mp4",
  "video/ogg",
  "video/quicktime",
  "video/webm",
] as const;

/**
 * BlockNote's standard media blocks share the same session-aware upload path.
 * Keep the policy finite to media the enabled blocks can actually render
 * (image, audio, video) and to formats browsers support. Documents such as PDF
 * or plain text, and non-renderable media containers, have no block and would
 * only produce an unrenderable upload, so they are rejected.
 */
export function isAllowedBlockNoteFile(
  contentType: string | undefined,
): boolean {
  if (!contentType) return false;
  return (
    isAllowedInlineImageType(contentType) ||
    (ALLOWED_BLOCKNOTE_AUDIO_TYPES as readonly string[]).includes(
      contentType,
    ) ||
    (ALLOWED_BLOCKNOTE_VIDEO_TYPES as readonly string[]).includes(contentType)
  );
}
