/**
 * Resolves the display cover source. A non-empty custom URL wins; `null` means
 * "render the local default cover". The default is a display concern and is
 * never persisted as a custom cover.
 */
export function resolveCoverUrl(
  custom: string | null | undefined,
): string | null {
  if (typeof custom !== "string") return null;
  const trimmed = custom.trim();
  return trimmed.length > 0 ? trimmed : null;
}
