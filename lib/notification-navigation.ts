"use client";

let cancelPending: (() => void) | undefined;

/** Feedback only: Next owns the transition and scroll; no covering or anchor hunt. */
export function navigateFromNotification(href: string, navigate: () => void) {
  cancelPending?.();
  const pathname = new URL(href, window.location.href).pathname;
  const source = window.location.pathname;
  let status: HTMLElement | undefined;
  const cleanup = () => {
    window.clearTimeout(timer);
    window.clearTimeout(timeout);
    observer.disconnect();
    window.removeEventListener("popstate", cleanup);
    status?.remove();
    if (cancelPending === cleanup) cancelPending = undefined;
  };
  const check = () => {
    if (window.location.pathname === pathname) {
      const page = document.querySelector("[data-notification-destination]");
      if (
        page?.getAttribute("data-notification-destination") === pathname ||
        document.querySelector(
          "[data-comment-destination-error], [data-testid=not-found-frame]",
        )
      )
        cleanup();
    } else if (window.location.pathname !== source) cleanup();
  };
  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = window.setTimeout(() => {
    status = document.createElement("div");
    status.setAttribute("role", "status");
    status.dataset.notificationNavigationStatus = "";
    status.className =
      "fixed bottom-4 right-4 z-[100] rounded-lg border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm";
    status.textContent = "Opening destination…";
    document.body.append(status);
  }, 150);
  // A cancelled/failed navigation must not leave feedback attached indefinitely.
  const timeout = window.setTimeout(cleanup, 10000);
  window.addEventListener("popstate", cleanup);
  cancelPending = cleanup;
  try {
    navigate();
    check();
  } catch (error) {
    cleanup();
    throw error;
  }
}

/** Position legacy article anchors once their async comment target exists. */
export function positionNotificationDestination(url: URL): boolean {
  const page = document.querySelector<HTMLElement>(
    "[data-notification-destination]",
  );
  if (!page || page.dataset.notificationDestination !== url.pathname)
    return false;
  if (page.dataset.testid === "not-found-frame") {
    window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  }
  const match = /^#comment-([a-z0-9]+)(-likes)?$/.exec(url.hash);
  const postLikes = url.hash === "#post-likes";
  const target = match
    ? document.getElementById(`comment-${match[1]}`)
    : postLikes
      ? document.getElementById("post-likes")
      : url.hash === "#comments"
        ? document.getElementById("comments")
        : null;
  if (url.hash && !target && (match || postLikes || url.hash === "#comments"))
    return false;
  if (target) {
    target.scrollIntoView({ block: "start", behavior: "instant" });
    const focusTarget =
      match?.[2] || postLikes
        ? (target.querySelector<HTMLElement>(
            postLikes ? "button" : "[data-comment-likes] button",
          ) ?? target)
        : target;
    focusTarget.focus({ preventScroll: true });
  } else {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return true;
}

/** A removed comment falls back to its thread once pagination is exhausted. */
export function finishMissingNotificationTarget() {
  document
    .getElementById("comments")
    ?.scrollIntoView({ block: "start", behavior: "instant" });
  cancelPending?.();
}
