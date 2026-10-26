"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;

/** Match SSR during hydration, then display the reader's local timezone. */
export function CommentTimestamp({ createdAt }: { createdAt: number }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    browserSnapshot,
    serverSnapshot,
  );
  const timeZone = hydrated ? undefined : "UTC";
  const date = new Date(createdAt);
  return (
    <time
      dateTime={date.toISOString()}
      className="text-xs text-muted-foreground ml-auto"
    >
      {date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone,
      })}
      {" at "}
      {date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      })}
    </time>
  );
}
