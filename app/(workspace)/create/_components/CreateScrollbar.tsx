"use client";

import { useEffect } from "react";

export function CreateScrollbar() {
  useEffect(() => {
    const root = document.documentElement;
    let header: HTMLElement | null = null;
    root.dataset.createScrollbar = "";

    const updateHeader = () => {
      root.style.setProperty(
        "--create-header-bottom",
        `${Math.max(0, header?.getBoundingClientRect().bottom ?? 0)}px`,
      );
    };
    const resizeObserver = new ResizeObserver(updateHeader);
    const findHeader = () => {
      const next = document.querySelector<HTMLElement>(
        '[data-testid="document-studio"] > header',
      );
      if (next === header) return;
      if (header) resizeObserver.unobserve(header);
      header = next;
      if (header) resizeObserver.observe(header);
      updateHeader();
    };
    const mutationObserver = new MutationObserver(findHeader);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    findHeader();

    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateHeader);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      root.style.removeProperty("--create-header-bottom");
      delete root.dataset.createScrollbar;
    };
  }, []);

  return null;
}
