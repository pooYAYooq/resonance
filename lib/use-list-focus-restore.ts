"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR = "button:not([disabled]), a[href]";
const TOGGLE_SELECTOR = "button[aria-pressed]";

/**
 * Restores keyboard focus after a list item is removed.
 *
 * When the focused control disappears with its removed item, the browser
 * falls back to the document body. This hook tracks the focused control and
 * the item that contains it. When the control disconnects, focus moves to the
 * same toggle action in the item now occupying the removed item's position
 * (or the last item when the removed one was last), or to that item's first
 * enabled control when the recorded toggle is missing or disabled. An emptied
 * list falls back to the first enabled control in the root (the recovery
 * action).
 *
 * Appending pagination is handled as well: when the disconnected control was
 * outside the items, such as the Load more button, focus moves to the first
 * appended item once the next page arrives instead of jumping back to the
 * top of the list while the page is still loading.
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
  const outsideItemCountRef = useRef<number | null>(null);

  const clearTracking = () => {
    focusedRef.current = null;
    itemIndexRef.current = null;
    toggleIndexRef.current = null;
    outsideItemCountRef.current = null;
  };

  // Runs after every render so a refilled list of the same length is still
  // detected through the removed control's disconnection.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      clearTracking();
      return;
    }

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      focusedRef.current = target;

      const item = target.closest<HTMLElement>(itemSelector);
      if (!item) {
        // A control outside the removable items, such as Load more. Record
        // how many items existed so an append can move focus to the new page.
        itemIndexRef.current = null;
        toggleIndexRef.current = null;
        outsideItemCountRef.current =
          root.querySelectorAll(itemSelector).length;
        return;
      }

      itemIndexRef.current = Array.from(
        root.querySelectorAll<HTMLElement>(itemSelector),
      ).indexOf(item);
      toggleIndexRef.current = target.matches(TOGGLE_SELECTOR)
        ? Array.from(
            item.querySelectorAll<HTMLElement>(TOGGLE_SELECTOR),
          ).indexOf(target)
        : null;
      outsideItemCountRef.current = null;
    };

    root.addEventListener("focusin", onFocusIn);

    const focused = focusedRef.current;
    if (focused && !focused.isConnected) {
      if (document.activeElement !== document.body) {
        clearTracking();
      } else {
        const itemIndex = itemIndexRef.current;
        const toggleIndex = toggleIndexRef.current;
        const outsideItemCount = outsideItemCountRef.current;
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(itemSelector),
        );

        if (itemIndex !== null) {
          const item =
            items.length > 0
              ? items[Math.min(itemIndex, items.length - 1)]
              : null;

          let target: HTMLElement | null = null;
          if (item) {
            if (toggleIndex !== null) {
              // Resolve the recorded ordinal against the full toggle list so
              // a disabled sibling cannot shift the action, then require the
              // recorded toggle itself to be enabled.
              const recordedToggle = Array.from(
                item.querySelectorAll<HTMLElement>(TOGGLE_SELECTOR),
              )[toggleIndex];
              if (recordedToggle && !recordedToggle.hasAttribute("disabled")) {
                target = recordedToggle;
              }
            }
            target ??= item.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
          } else {
            target = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
          }

          target?.focus();
          clearTracking();
        } else if (
          outsideItemCount !== null &&
          items.length > outsideItemCount
        ) {
          items[outsideItemCount]
            .querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
            ?.focus();
          clearTracking();
        }
        // Otherwise keep tracking while the next page is still loading; the
        // activeElement guard above clears it once focus moves elsewhere.
      }
    }

    return () => root.removeEventListener("focusin", onFocusIn);
  });
}
