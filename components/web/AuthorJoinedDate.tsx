/**
 * Live "Joined ..." label for the author kicker.
 *
 * The label depends on the current time for the relative display, which would
 * otherwise make server and client render differently. The server passes one
 * `initialNow`, the first client render reuses it (hydration-safe), and only
 * after mount does the label refresh from the browser clock: immediately, then
 * at most once a minute while the tab is visible, and immediately again when a
 * hidden tab becomes visible. Timers are stopped while hidden and cleared on
 * unmount, so a background tab does no clock work.
 *
 * A null `joinedAt` renders nothing so callers can place this unconditionally
 * inside the kicker's optional segment.
 */

"use client";

import { useEffect, useState } from "react";
import { formatJoinedDate } from "@/lib/profile-joined-date";
import type { JoinDateDisplay } from "@/lib/profile-identity";

const MINUTE_MS = 60_000;

interface AuthorJoinedDateProps {
  /** Join timestamp, or null when the author has none stored. */
  joinedAt: number | null;
  /** Calendar (fixed month/year) or relative (elapsed) formatting. */
  display: JoinDateDisplay;
  /** Server-rendered clock, reused for the hydration-safe first render. */
  initialNow: number;
}

export function AuthorJoinedDate({
  joinedAt,
  display,
  initialNow,
}: AuthorJoinedDateProps) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    if (joinedAt === null) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      if (timer === null) {
        timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
      }
    };
    const sync = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        start();
      } else {
        stop();
      }
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [joinedAt]);

  if (joinedAt === null) return null;

  return <span>{`Joined ${formatJoinedDate(joinedAt, display, now)}`}</span>;
}
