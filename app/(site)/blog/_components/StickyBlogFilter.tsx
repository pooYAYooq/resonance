"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Keeps the Blog search/Topics bar under the sticky navbar without a hardcoded
 * offset. Measuring the nav avoids a fractional-height seam that can make the
 * sticky edge snap while scrolling.
 */
export function StickyBlogFilter({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nav = document.querySelector("nav");
    const node = ref.current;
    if (!nav || !node) return;

    const shortLandscape = window.matchMedia(
      "(max-height: 500px) and (orientation: landscape)",
    );
    const update = () => {
      const isShortLandscape = shortLandscape.matches;
      // In a short landscape viewport the fixed navbar and filter would leave
      // almost no room for a post. Let the navbar scroll away and keep only the
      // filter pinned at the top.
      nav.style.position = isShortLandscape ? "static" : "";
      // Keep the navbar's own border, but let the filter tuck 1px underneath
      // it. The border then draws over the filter background and a fractional
      // device-pixel gap cannot reveal a post cover as a seam.
      node.style.top = isShortLandscape
        ? "0px"
        : `${Math.max(0, nav.getBoundingClientRect().height - 1)}px`;
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(nav);
    shortLandscape.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      shortLandscape.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      nav.style.position = "";
    };
  }, []);

  return (
    <div
      ref={ref}
      data-testid="blog-filter-sticky"
      className="sticky top-[64px] z-40 -mx-4 bg-background px-4 py-3 will-change-transform [@media(max-height:500px)_and_(orientation:landscape)]:py-2 md:-mx-6 md:px-6 md:top-[56px] lg:-mx-8 lg:px-8"
    >
      {children}
    </div>
  );
}
