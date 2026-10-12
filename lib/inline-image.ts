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

/** Leading bytes read for signature checks; WebP needs the first twelve. */
export const MEDIA_HEADER_BYTES = 16;

const matchesAscii = (bytes: Uint8Array, offset: number, text: string) =>
  [...text].every(
    (character, index) => bytes[offset + index] === character.charCodeAt(0),
  );

const IMAGE_SIGNATURES: Record<
  (typeof ALLOWED_INLINE_IMAGE_TYPES)[number],
  (bytes: Uint8Array) => boolean
> = {
  "image/jpeg": (bytes) =>
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) =>
    bytes[0] === 0x89 &&
    matchesAscii(bytes, 1, "PNG") &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a,
  "image/webp": (bytes) =>
    matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP"),
};

/**
 * Checks the leading bytes of an upload against the signature for its declared
 * content type. Metadata alone cannot prove that bytes labelled as an image
 * render, so the declared type must match the stored bytes.
 *
 * @param contentType - The declared upload content type
 * @param bytes - The leading bytes of the stored object
 * @returns True when the bytes match a signature for the declared image type
 */
export function hasImageSignature(
  contentType: string | undefined,
  bytes: Uint8Array,
): boolean {
  if (!isAllowedInlineImageType(contentType)) return false;
  return IMAGE_SIGNATURES[contentType](bytes);
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
