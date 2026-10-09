"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR = "button, a[href]";

/**
 * Restores keyboard focus after list items are removed.
 *
 * When a focused control disappears with its removed item, the browser falls
 * back to the document body. This hook tracks the position of the focused
 * control while focus is inside the list and, after the item count shrinks,
 * moves focus to the nearest surviving control in the list, or to the
 * recovery action when the list empties.
 */
export function useListFocusRestore(
  rootRef: RefObject<HTMLElement | null>,
  itemCount: number,
) {
  const lastIndexRef = useRef<number | null>(null);
  const previousCountRef = useRef(itemCount);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onFocusIn = (event: FocusEvent) => {
      const controls = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const index = controls.indexOf(event.target as HTMLElement);
      if (index >= 0) lastIndexRef.current = index;
    };

    root.addEventListener("focusin", onFocusIn);
    return () => root.removeEventListener("focusin", onFocusIn);
  }, [rootRef, itemCount]);

  useEffect(() => {
    const previousCount = previousCountRef.current;
    previousCountRef.current = itemCount;

    const lastIndex = lastIndexRef.current;
    if (lastIndex === null || itemCount >= previousCount) return;
    if (document.activeElement !== document.body) return;

    const root = rootRef.current;
    if (!root) return;

    const controls = Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (controls.length === 0) return;

    controls[Math.min(lastIndex, controls.length - 1)].focus();
    lastIndexRef.current = null;
  }, [itemCount, rootRef]);
}
