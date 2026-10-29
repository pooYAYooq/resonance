import { describe, expect, it } from "vitest";
import { formatPostDate, formatRelativeTime } from "./relative-time";

const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);

describe("formatRelativeTime", () => {
  it("uses just now under a minute and for future timestamps", () => {
    expect(formatRelativeTime(NOW - 59_000, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe("just now");
  });

  it("uses minutes, hours, and days under a week", () => {
    expect(formatRelativeTime(NOW - 59_999, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW - 60_001, NOW)).toBe("1m ago");
    expect(formatRelativeTime(NOW - 90_000, NOW)).toBe("1m ago");
    expect(formatRelativeTime(NOW - 3_599_999, NOW)).toBe("59m ago");
    expect(formatRelativeTime(NOW - 3_600_001, NOW)).toBe("1h ago");
    expect(formatRelativeTime(NOW - 90 * 60_000, NOW)).toBe("1h ago");
    expect(formatRelativeTime(NOW - 86_399_999, NOW)).toBe("23h ago");
    expect(formatRelativeTime(NOW - 86_400_001, NOW)).toBe("1d ago");
    expect(formatRelativeTime(NOW - 6 * 24 * 60 * 60_000, NOW)).toBe("6d ago");
    expect(formatRelativeTime(NOW - 7 * 24 * 60 * 60_000 + 1, NOW)).toBe(
      "6d ago",
    );
  });

  it("falls back to the absolute UTC date from seven days", () => {
    expect(formatRelativeTime(NOW - 7 * 24 * 60 * 60_000, NOW)).toBe(
      "Oct 23, 2026",
    );
  });
});

describe("formatPostDate", () => {
  it("renders a concise UTC date without a Published label", () => {
    expect(formatPostDate(Date.UTC(2026, 0, 2))).toBe("Jan 2, 2026");
    expect(formatPostDate(Date.UTC(2026, 0, 2, 0, 30))).toBe("Jan 2, 2026");
    expect(formatPostDate(Date.UTC(2026, 0, 2, 23, 30))).toBe("Jan 2, 2026");
  });
});
