const PREFIX = "resonance:collection-groups";

type CollectionName = "saved" | "liked";

/** Stable per-user, per-collection key for session-scoped collapse state. */
export function collectionGroupStorageKey(
  userId: string,
  collection: CollectionName,
): string {
  return `${PREFIX}:${userId}:${collection}`;
}

/** Reads collapsed group keys, ignoring missing or malformed storage. */
export function readCollapsedGroups(
  storageKey: string | undefined,
): ReadonlySet<string> {
  if (!storageKey || typeof window === "undefined") return new Set();

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((value): value is string => typeof value === "string"),
    );
  } catch {
    return new Set();
  }
}

/** Writes collapsed group keys, ignoring unavailable storage. */
export function writeCollapsedGroups(
  storageKey: string | undefined,
  collapsedGroups: ReadonlySet<string>,
): void {
  if (!storageKey || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify([...collapsedGroups]),
    );
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
}
