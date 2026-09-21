import { describe, expect, it } from "vitest";
import { COVER_RETRY_DELAYS_MS, coverRetryDelayMs } from "./coverResolution";

describe("coverRetryDelayMs", () => {
  it("returns each configured backoff delay in order", () => {
    COVER_RETRY_DELAYS_MS.forEach((delay, attempt) => {
      expect(coverRetryDelayMs(attempt)).toBe(delay);
    });
  });

  it("returns null once the attempts are exhausted", () => {
    expect(coverRetryDelayMs(COVER_RETRY_DELAYS_MS.length)).toBeNull();
    expect(coverRetryDelayMs(COVER_RETRY_DELAYS_MS.length + 5)).toBeNull();
  });

  it("keeps the schedule short enough to be a retry, not a hang", () => {
    const total = COVER_RETRY_DELAYS_MS.reduce((sum, delay) => sum + delay, 0);
    expect(total).toBeLessThanOrEqual(30_000);
  });
});
