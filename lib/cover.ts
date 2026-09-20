/**
 * Resolves the display cover source. A non-empty custom URL wins; `null` means
 * "render the blank fallback". The fallback is a transparent surface with a
 * subtle bottom border: no fallback image is loaded, and nothing is persisted
 * as a cover.
 */
export function resolveCoverUrl(
  custom: string | null | undefined,
): string | null {
  if (typeof custom !== "string") return null;
  const trimmed = custom.trim();
  return trimmed.length > 0 ? trimmed : null;
}
