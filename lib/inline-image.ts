export const MAX_INLINE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_INLINE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function isAllowedInlineImageType(
  contentType: string | undefined,
): contentType is (typeof ALLOWED_INLINE_IMAGE_TYPES)[number] {
  return (
    contentType !== undefined &&
    (ALLOWED_INLINE_IMAGE_TYPES as readonly string[]).includes(contentType)
  );
}
