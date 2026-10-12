import { describe, expect, it } from "vitest";
import { formatJoinedDate } from "./profile-joined-date";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 5, 15, 12);

describe("formatJoinedDate", () => {
  it("formats the calendar month and year in UTC", () => {
    expect(formatJoinedDate(Date.UTC(2026, 0, 1, 23), "calendar", now)).toBe(
      "January 2026",
    );
    expect(formatJoinedDate(Date.UTC(2025, 11, 31, 23), "calendar", now)).toBe(
      "December 2025",
    );
  });

  it("labels sub-day elapsed time as a recent join", () => {
    expect(formatJoinedDate(now - 1, "relative", now)).toBe("recently");
    expect(formatJoinedDate(now - DAY + 1, "relative", now)).toBe("recently");
  });

  it("floors whole days below 30", () => {
    expect(formatJoinedDate(now - DAY, "relative", now)).toBe("1 day ago");
    expect(formatJoinedDate(now - 2 * DAY, "relative", now)).toBe("2 days ago");
    expect(formatJoinedDate(now - 29 * DAY, "relative", now)).toBe(
      "29 days ago",
    );
  });

  it("floors whole 30-day months below 365 days", () => {
    expect(formatJoinedDate(now - 30 * DAY, "relative", now)).toBe(
      "1 month ago",
    );
    expect(formatJoinedDate(now - 364 * DAY, "relative", now)).toBe(
      "12 months ago",
    );
  });

  it("floors whole 365-day years from one year", () => {
    expect(formatJoinedDate(now - 365 * DAY, "relative", now)).toBe(
      "1 year ago",
    );
    expect(formatJoinedDate(now - 800 * DAY, "relative", now)).toBe(
      "2 years ago",
    );
  });

  it("clamps future timestamps instead of showing future membership", () => {
    expect(formatJoinedDate(now + 10 * DAY, "relative", now)).toBe("recently");
    expect(formatJoinedDate(now + 10 * DAY, "calendar", now)).toBe("June 2026");
  });
});
