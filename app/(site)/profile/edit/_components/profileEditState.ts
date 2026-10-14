/**
 * Pure form-state helpers shared by the identity and selected-work forms.
 *
 * Each editable surface keeps its own `{ value, baseline, revision, conflict }`
 * snapshot so identity saving and selection saving stay independent. The
 * helpers encode the two ways a saved revision reaches a form: our own
 * successful submission (`reconcileSaved`) and a server/query echo from any
 * session (`receiveSaved`). Neither path may overwrite newer unsaved typing.
 */

export type EditState<T> = {
  value: T;
  baseline: T;
  revision: number;
  conflict: boolean;
};

/** A clean form initialized from the newest saved value. */
export function initialEditState<T>(value: T, revision: number): EditState<T> {
  return { value, baseline: value, revision, conflict: false };
}

/** True when the current input differs from the last saved baseline. */
export function isDirty<T>(
  state: EditState<T>,
  equal: (a: T, b: T) => boolean,
): boolean {
  return !equal(state.value, state.baseline);
}

/**
 * Applies our own successful save: baseline moves to the submitted snapshot and
 * revision advances. A newer value typed while the save was pending is kept.
 */
export function reconcileSaved<T>(
  state: EditState<T>,
  submitted: T,
  revision: number,
): EditState<T> {
  return { ...state, baseline: submitted, revision, conflict: false };
}

/**
 * Applies a server/query value at a new revision. A clean form adopts it; a
 * dirty form keeps its input and flags a conflict for explicit reload.
 */
export function receiveSaved<T>(
  state: EditState<T>,
  value: T,
  revision: number,
  equal: (a: T, b: T) => boolean,
): EditState<T> {
  // A settled mutation can be ahead of the reactive query. Never roll the
  // saved baseline back to a same/older query echo.
  if (revision <= state.revision) return state;
  if (equal(state.value, state.baseline)) {
    return { value, baseline: value, revision, conflict: false };
  }
  return { ...state, conflict: true };
}

/** Flags a revision conflict (stale save or dirty query echo) without clearing input. */
export function markConflict<T>(state: EditState<T>): EditState<T> {
  return { ...state, conflict: true };
}

export type EditFieldError = { field: string; message: string };

/**
 * Reads the `{ field, message }` payload a Convex validation error carries, so
 * a rejected write can attach its message to the right control without matching
 * message text. Returns null for unexpected/network errors.
 */
export function readEditFieldError(error: unknown): EditFieldError | null {
  if (typeof error !== "object" || error === null) return null;
  const data = (error as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const { field, message } = data as { field?: unknown; message?: unknown };
  if (typeof field === "string" && typeof message === "string") {
    return { field, message };
  }
  return null;
}

/**
 * Moves one entry within an ordered list, returning a copy. Out-of-range moves
 * return an unmodified copy so callers never mutate the input.
 */
export function moveSelected<T>(
  ids: readonly T[],
  from: number,
  to: number,
): T[] {
  if (to < 0 || to >= ids.length || from < 0 || from >= ids.length) {
    return [...ids];
  }
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** Cache only chosen cards, never the history of browsed/search results. */
export function cacheSelectedCards<T extends { postId: string }>(
  previous: Record<string, T>,
  selectedIds: readonly string[],
  updates: readonly T[],
): Record<string, T> {
  const selected = new Set(selectedIds);
  const incoming = new Map<string, T>();
  for (const entry of updates) {
    if (selected.has(entry.postId)) incoming.set(entry.postId, entry);
  }
  const next: Record<string, T> = {};
  let changed = false;
  for (const id of selectedIds) {
    const entry = incoming.get(id) ?? previous[id];
    if (!entry) continue;
    next[id] = entry;
    if (entry !== previous[id]) changed = true;
  }
  if (Object.keys(previous).length !== Object.keys(next).length) changed = true;
  return changed ? next : previous;
}
