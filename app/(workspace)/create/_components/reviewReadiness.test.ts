import { describe, expect, it } from "vitest";
import { getReviewBlocker, REVIEW_BLOCKER_MESSAGES } from "./reviewReadiness";

const media = (
  overrides: Partial<{
    pending: string[];
    failed: string[];
    coverSelected: boolean;
  }> = {},
) => ({
  pending: [],
  failed: [],
  coverSelected: false,
  ...overrides,
});

describe("getReviewBlocker", () => {
  it("returns null when every media asset is resolved", () => {
    expect(getReviewBlocker(media())).toBeNull();
  });

  it("prioritizes failed media over pending media", () => {
    expect(getReviewBlocker(media({ failed: ["a"], pending: ["b"] }))).toBe(
      "failed-media",
    );
  });

  it("blocks on pending media", () => {
    expect(getReviewBlocker(media({ pending: ["a"] }))).toBe("pending-media");
  });

  it("does not block on a selected cover, which submit uploads", () => {
    expect(getReviewBlocker(media({ coverSelected: true }))).toBeNull();
  });

  it("has a human message for every blocker", () => {
    for (const message of Object.values(REVIEW_BLOCKER_MESSAGES)) {
      expect(message.length).toBeGreaterThan(0);
    }
  });
});
