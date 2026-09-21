export type CoverLookup =
  | { status: "resolved"; url: string }
  | { status: "missing" }
  | { status: "unavailable" };

/** Backoff before each automatic retry of a transient cover lookup. */
export const COVER_RETRY_DELAYS_MS = [2_000, 5_000, 15_000] as const;

/**
 * The delay before the next automatic retry, or null once the attempts are
 * exhausted. The caller surfaces the failure alert when this returns null.
 */
export function coverRetryDelayMs(attempt: number): number | null {
  return COVER_RETRY_DELAYS_MS[attempt] ?? null;
}
