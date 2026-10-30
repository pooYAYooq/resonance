"use client";

import { useEffect } from "react";

/** Keep native scrollbar feedback consistent for the viewport and panels. */
export function ScrollbarBehavior() {
  useEffect(() => {
    const root = document.documentElement;
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    let hasSuppressed = false;

    function targetFor(event: Event): HTMLElement | null {
      if (event.target === document || event.target === window) return root;
      return event.target instanceof HTMLElement ? event.target : null;
    }

    function finish(element: HTMLElement) {
      clearTimeout(timers.get(element));
      timers.set(
        element,
        setTimeout(() => {
          timers.delete(element);
          delete element.dataset.scrollbarScrolling;
          if (
            !CSS.supports("selector(::-webkit-scrollbar)") ||
            (element === root &&
              document.body.hasAttribute("data-scroll-locked"))
          )
            return;

          // Chromium can retain the painted hover state after a thumb drag.
          // Recreate the scrollbar after scrollend, preserving position and styles.
          const overflowX = element.style.getPropertyValue("overflow-x");
          const priorityX = element.style.getPropertyPriority("overflow-x");
          const overflowY = element.style.getPropertyValue("overflow-y");
          const priorityY = element.style.getPropertyPriority("overflow-y");
          const top = element.scrollTop;
          const left = element.scrollLeft;
          element.style.setProperty("overflow", "hidden");
          void element.clientWidth;
          element.style.removeProperty("overflow");
          if (overflowX)
            element.style.setProperty("overflow-x", overflowX, priorityX);
          if (overflowY)
            element.style.setProperty("overflow-y", overflowY, priorityY);
          if (element.scrollTop !== top) element.scrollTop = top;
          if (element.scrollLeft !== left) element.scrollLeft = left;
        }, 150),
      );
    }

    function onScroll(event: Event) {
      const element = targetFor(event);
      if (!element) return;
      clearTimeout(timers.get(element));
      timers.delete(element);
      hasSuppressed = true;
      element.dataset.scrollbarScrolling = "";
      element.dataset.scrollbarHoverSuppressed = "";
      if (!("onscrollend" in element)) finish(element);
    }

    function onScrollEnd(event: Event) {
      const element = targetFor(event);
      if (element && "scrollbarScrolling" in element.dataset) finish(element);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.buttons !== 0 || !hasSuppressed) return;
      hasSuppressed = false;
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-scrollbar-hover-suppressed]",
      )) {
        if (!("scrollbarScrolling" in element.dataset)) {
          delete element.dataset.scrollbarHoverSuppressed;
        } else hasSuppressed = true;
      }
    }

    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("scrollend", onScrollEnd, true);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("scrollend", onScrollEnd, true);
      window.removeEventListener("pointermove", onPointerMove);
      for (const timeout of timers.values()) clearTimeout(timeout);
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-scrollbar-scrolling], [data-scrollbar-hover-suppressed]",
      )) {
        delete element.dataset.scrollbarScrolling;
        delete element.dataset.scrollbarHoverSuppressed;
      }
    };
  }, []);

  return null;
}
