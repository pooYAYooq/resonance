"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR = "button:not([disabled]), a[href]";
const TOGGLE_SELECTOR = "button[aria-pressed]:not([disabled])";

/**
 * Restores keyboard focus after a list item is removed.
 *
 * When the focused control disappears with its removed item, the browser
 * falls back to the document body. This hook tracks the focused control and
 * the item that contains it. When the control disconnects, focus moves to the
 * same toggle action in the item now occupying the removed item's position
 * (or the last item when the removed one was last), or to that item's first
 * enabled control when no matching enabled toggle exists. An emptied list
 * falls back to the first enabled control in the root (the recovery action).
 *
 * Tracking the control's identity rather than a count keeps the restore
 * working when a paginated query refills a removed row without changing the
 * item count. Tracking the item and toggle action rather than a global
 * control index keeps the target stable across items with different control
 * counts, such as cards with different numbers of tag links.
 *
 * @param rootRef - Ref to the list container; focus events inside it are
 *   tracked, and it is the last-resort scope for a restore target.
 * @param itemSelector - Selector for the removable items within the root.
 */
export function useListFocusRestore(
  rootRef: RefObject<HTMLElement | null>,
  itemSelector: string,
) {
  const focusedRef = useRef<HTMLElement | null>(null);
  const itemIndexRef = useRef<number | null>(null);
  const toggleIndexRef = useRef<number | null>(null);

  // Runs after every render so a refilled list of the same length is still
  // detected through the removed control's disconnection.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      focusedRef.current = null;
      itemIndexRef.current = null;
      toggleIndexRef.current = null;
      return;
    }

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      focusedRef.current = target;

      const item = target.closest<HTMLElement>(itemSelector);
      if (!item) {
        itemIndexRef.current = null;
        toggleIndexRef.current = null;
        return;
      }

      itemIndexRef.current = Array.from(
        root.querySelectorAll<HTMLElement>(itemSelector),
      ).indexOf(item);
      toggleIndexRef.current = target.matches("button[aria-pressed]")
        ? Array.from(
            item.querySelectorAll<HTMLElement>("button[aria-pressed]"),
          ).indexOf(target)
        : null;
    };

    root.addEventListener("focusin", onFocusIn);

    const focused = focusedRef.current;
    if (focused && !focused.isConnected) {
      if (document.activeElement === document.body) {
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(itemSelector),
        );
        const item =
          items.length > 0
            ? items[Math.min(itemIndexRef.current ?? 0, items.length - 1)]
            : null;

        let target: HTMLElement | null = null;
        if (item) {
          if (toggleIndexRef.current !== null) {
            target =
              Array.from(item.querySelectorAll<HTMLElement>(TOGGLE_SELECTOR))[
                toggleIndexRef.current
              ] ?? null;
          }
          target ??= item.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        } else {
          target = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        }

        target?.focus();
      }

      focusedRef.current = null;
      itemIndexRef.current = null;
      toggleIndexRef.current = null;
    }

    return () => root.removeEventListener("focusin", onFocusIn);
  });
}
