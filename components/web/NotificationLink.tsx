"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type ComponentProps } from "react";
import { useOptionalAuthoringExit } from "./AuthoringExitProvider";
import { navigateFromNotification } from "@/lib/notification-navigation";

/** Preserve authoring guards and native new-tab behavior for notification links. */
export function NotificationLink({
  onNavigate,
  onPointerEnter,
  onFocus,
  prefetch,
  ...props
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  const authoringExit = useOptionalAuthoringExit();
  const prefetched = useRef(new Set<string>());
  const prefetchOnIntent = () => {
    const href = props.href;
    if (
      prefetch === false ||
      typeof href !== "string" ||
      prefetched.current.has(href)
    )
      return;
    prefetched.current.add(href);
    router.prefetch(href);
  };
  return (
    <Link
      {...props}
      prefetch={false}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented && event.pointerType === "mouse")
          prefetchOnIntent();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (
          !event.defaultPrevented &&
          event.currentTarget.matches(":focus-visible")
        )
          prefetchOnIntent();
      }}
      data-authoring-exit-managed={
        typeof props.href === "string" ? "" : undefined
      }
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault: () => {
            prevented = true;
          },
        });
        if (prevented) {
          event.preventDefault();
          return;
        }
        const href = typeof props.href === "string" ? props.href : undefined;
        if (!href) return;
        event.preventDefault();
        const continueNavigation = () =>
          navigateFromNotification(href, () => {
            const destination = new URL(href, window.location.href);
            if (destination.pathname === window.location.pathname) {
              // Next preserves scroll for an already-open route.
              window.scrollTo({ top: 0, behavior: "instant" });
            }
            router.push(href, { scroll: true });
          });
        if (authoringExit) {
          authoringExit.request({
            kind: "navigate",
            href,
            onContinue: continueNavigation,
          });
        } else {
          continueNavigation();
        }
      }}
    />
  );
}
