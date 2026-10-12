import type { JoinDateDisplay } from "./profile-identity";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const CALENDAR_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function relativeLabel(value: number, unit: "day" | "month" | "year"): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

/**
 * Formats the join date without a leading label so callers can prefix it.
 * Calendar uses the UTC month and year. Relative floors elapsed time at the
 * fixed unit thresholds and clamps future timestamps to a recent join.
 */
export function formatJoinedDate(
  joinedAt: number,
  display: JoinDateDisplay,
  now: number,
): string {
  if (display === "calendar") {
    const date = new Date(joinedAt);
    return `${CALENDAR_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }
  const elapsed = Math.max(0, now - joinedAt);
  if (elapsed < DAY_MS) return "recently";
  if (elapsed < MONTH_MS)
    return relativeLabel(Math.floor(elapsed / DAY_MS), "day");
  if (elapsed < YEAR_MS)
    return relativeLabel(Math.floor(elapsed / MONTH_MS), "month");
  return relativeLabel(Math.floor(elapsed / YEAR_MS), "year");
}
