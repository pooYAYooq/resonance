"use client";

const EXPANSION_CHANGED = "notification-expansion-changed";
const expansionFallback = new Map<string, boolean>();

export function subscribeToExpansion(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EXPANSION_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EXPANSION_CHANGED, onChange);
  };
}

export function readExpansion(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "expanded";
  } catch {
    // Keep toggling usable when browser storage is unavailable.
    return expansionFallback.get(key) ?? false;
  }
}

function writeExpansion(key: string, expanded: boolean) {
  expansionFallback.set(key, expanded);
  try {
    if (expanded) window.localStorage.setItem(key, "expanded");
    else window.localStorage.removeItem(key);
  } catch {
    // The in-memory fallback lasts until this page is reloaded.
  }
}

export const collapsedOnServer = () => false;

export function notificationExpansionKey(notification: {
  recipientId: string;
  _id: string;
}) {
  return `resonance:notification-expanded:${notification.recipientId}:${notification._id}`;
}

export function toggleExpansion(key: string) {
  writeExpansion(key, !readExpansion(key));
  window.dispatchEvent(new Event(EXPANSION_CHANGED));
}

export function setNotificationsExpanded(
  notifications: ReadonlyArray<{ recipientId: string; _id: string }>,
  expanded: boolean,
) {
  for (const notification of notifications) {
    writeExpansion(notificationExpansionKey(notification), expanded);
  }
  window.dispatchEvent(new Event(EXPANSION_CHANGED));
}
