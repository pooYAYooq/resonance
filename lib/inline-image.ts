export const MAX_INLINE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

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
