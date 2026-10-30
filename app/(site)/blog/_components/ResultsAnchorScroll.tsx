"use client";

import { useEffect } from "react";

/**
 * Hash scrolling can run before the sticky filter bar has settled, leaving the
 * results title too low. Re-run it after the mode renders so the title lands
 * directly below the sticky controls.
 */
export function ResultsAnchorScroll({ modeKey }: { modeKey: string }) {
  useEffect(() => {
    if (window.location.hash !== "#blog-results") return;
    const target = document.getElementById("blog-results");
    if (!target) return;

    const frame = requestAnimationFrame(() => {
      const margin =
        Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - margin;
      window.scrollTo({ top, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [modeKey]);

  return null;
}
