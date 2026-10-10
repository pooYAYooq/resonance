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
 * action), or to the root itself if it is programmatically focusable and has
 * no enabled controls.
 *
 * Appending pagination is handled as well: when the disconnected control was
 * outside the items, such as the Load more button, focus moves to the first
 * appended item once the next page arrives instead of jumping back to the
 * top of the list while the page is still loading. While `pending` reports
 * the request as in flight, that disconnect keeps waiting; when the request
 * settles without appending a visible item, focus moves to the replacement
 * control outside the items, or to the last item when none remains.
 *
 * Restoration keeps tracking through the focus event, which records the
 * restored control, so a later removal of that control restores focus in
 * turn. Tracking is dropped when focus deliberately leaves the list while
 * its control still exists, so a later removal cannot pull focus back
 * unexpectedly.
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
 * @param pending - Whether the next page request is still in flight; a
 *   disconnected outside-item control waits for the settled render.
 */
export function useListFocusRestore(
  rootRef: RefObject<HTMLElement | null>,
  itemSelector: string,
  pending: boolean,
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
      // The list root can disappear for a loading render, such as an empty
      // page swapping to a spinner. Keep pending tracking so the append
      // restore still runs when the root and its items come back.
      return;
    }

    const trackControl = (target: HTMLElement) => {
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

    const onFocusIn = (event: FocusEvent) => {
      trackControl(event.target as HTMLElement);
    };

    root.addEventListener("focusin", onFocusIn);

    // A known outside target is a deliberate departure. With no next target,
    // Chromium can fire focusout during removal before isConnected changes;
    // wait until the DOM operation finishes before classifying it as a blur.
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && root.contains(next)) return;
      const focused = focusedRef.current;
      if (!focused) return;
      if (next) {
        clearTracking();
      } else {
        queueMicrotask(() => {
          if (focusedRef.current === focused && focused.isConnected) {
            clearTracking();
          }
        });
      }
    };
    root.addEventListener("focusout", onFocusOut);

    const focused = focusedRef.current;
    if (focused && focused.isConnected && root.contains(focused)) {
      // Keyed cards can move without another focusin event. Keep their latest
      // position (and a focused pagination control's boundary) until removal.
      trackControl(focused);
    } else if (focused && !focused.isConnected) {
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
            target =
              root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? root;
          }

          target?.focus();
        } else if (outsideItemCount !== null) {
          if (items.length > outsideItemCount) {
            items[outsideItemCount]
              .querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
              ?.focus();
          } else if (!pending) {
            // The request settled without appending a visible item, such as
            // a page containing only deleted or unpublished posts. Focus the
            // first control outside the items (a replacement Load more
            // button or the empty state action), or the last item when the
            // exhausted list has no trailing control left.
            const replacement = Array.from(
              root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
            ).find((control) => !control.closest(itemSelector));
            if (replacement) {
              replacement.focus();
            } else if (items.length > 0) {
              items[items.length - 1]
                .querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
                ?.focus();
            } else {
              // An empty list may have no recovery action. Consumers can make
              // its named context focusable without adding a new tab stop.
              root.focus();
            }
          }
        }
        // Restores keep tracking through the focus event, which records the
        // restored control; a pending append keeps waiting instead. The
        // activeElement guard above clears tracking once focus moves
        // elsewhere.
      }
    }

    return () => {
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
    };
  });
}
