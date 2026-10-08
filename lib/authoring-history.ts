/**
 * Browser traversal adapter for the authoring exit guard. It uses the
 * Navigation API (the only mechanism that can synchronously cancel
 * same-document Back/Forward traversals) and stays deliberately free of
 * editor, router, and storage knowledge. The provider owns every decision;
 * this module only reports destinations and replays one remembered entry.
 *
 * Older browsers without the Navigation API return null from
 * `getNavigationApi`; the recovery copy remains the fallback safety net.
 */

export type NavigateEventLike = {
  canIntercept: boolean;
  cancelable: boolean;
  hashChange: boolean;
  downloadRequest: string | null;
  formData: unknown;
  navigationType: string;
  destination: {
    key: string;
    sameDocument: boolean;
    url: string;
  };
  intercept: (options?: { handler?: () => Promise<void> }) => void;
  preventDefault: () => void;
};

export type NavigationLike = {
  addEventListener: (
    type: "navigate",
    listener: (event: NavigateEventLike) => void,
  ) => void;
  removeEventListener: (
    type: "navigate",
    listener: (event: NavigateEventLike) => void,
  ) => void;
  traverseTo: (key: string, options?: { info?: unknown }) => void;
};

export type HistoryTraversalGuard = {
  /** Replay one remembered entry, bypassing the guard on that single event. */
  replay: (key: string) => boolean;
  dispose: () => void;
};

export type TraversalDestination = {
  key: string;
  href: string;
};

/** Absolute destination URLs from the traversal event become app-relative. */
function toAppHref(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.pathname + parsed.search + parsed.hash;
}

/**
 * Returns the platform Navigation API when it exposes the surface this
 * adapter needs, otherwise null so callers can fall back safely.
 */
export function getNavigationApi(): NavigationLike | null {
  const candidate = (globalThis as { navigation?: unknown }).navigation;
  if (!candidate || typeof candidate !== "object") return null;
  const navigation = candidate as Partial<NavigationLike>;
  if (
    typeof navigation.addEventListener !== "function" ||
    typeof navigation.removeEventListener !== "function" ||
    typeof navigation.traverseTo !== "function"
  ) {
    return null;
  }
  return navigation as NavigationLike;
}

export function createHistoryTraversalGuard({
  navigation,
  onTraverse,
  onUncancelableTraverse,
}: {
  navigation: NavigationLike;
  /** Return true to cancel this traversal and keep the destination pending. */
  onTraverse: (destination: TraversalDestination) => boolean;
  /**
   * Called when the browser will commit this traversal regardless, so the
   * only available protection is persisting recoverable work immediately.
   */
  onUncancelableTraverse?: () => void;
}): HistoryTraversalGuard {
  let pendingReplayKey: string | null = null;

  const listener = (event: NavigateEventLike) => {
    if (event.navigationType !== "traverse") return;
    if (!event.canIntercept) return;
    if (!event.destination?.sameDocument) return;
    if (event.hashChange) return;
    if (event.downloadRequest !== null) return;
    if (event.formData !== null && event.formData !== undefined) return;
    const key = event.destination.key;
    if (key === "") return;

    if (pendingReplayKey !== null) {
      const bypass = pendingReplayKey === key;
      pendingReplayKey = null;
      if (bypass) return;
    }

    const href = toAppHref(event.destination.url);
    if (href === null) return;
    if (!event.cancelable) {
      // preventDefault() is a no-op here and the traversal commits, so a
      // cancelled-looking dialog would sit over the wrong page. Let the
      // provider persist recoverable work synchronously instead.
      onUncancelableTraverse?.();
      return;
    }
    if (onTraverse({ key, href })) {
      try {
        // intercept() handles a navigation but still commits its destination.
        // Cancellation must keep both the editor and URL on the current entry.
        event.preventDefault();
      } catch {
        // An unusable event cannot safely be replayed by this adapter.
      }
    }
  };

  navigation.addEventListener("navigate", listener);

  return {
    replay(key) {
      pendingReplayKey = key;
      try {
        navigation.traverseTo(key);
        return true;
      } catch {
        pendingReplayKey = null;
        return false;
      }
    },
    dispose() {
      navigation.removeEventListener("navigate", listener);
    },
  };
}
