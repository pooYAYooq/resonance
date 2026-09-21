import { describe, expect, it } from "vitest";
import {
  getReviewBlocker,
  getReviewSubmitBlock,
  REVIEW_BLOCKER_MESSAGES,
} from "./reviewReadiness";

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

  it("points failed media at replace or remove, never retry", () => {
    const message = REVIEW_BLOCKER_MESSAGES["failed-media"];
    expect(message).toMatch(/replace/i);
    expect(message).not.toMatch(/retry/i);
  });
});

describe("getReviewSubmitBlock", () => {
  it("blocks while a write is in flight", () => {
    expect(
      getReviewSubmitBlock({
        isPending: true,
        hasPendingTarget: false,
        blocker: null,
      }),
    ).toBe("operation-in-flight");
  });

  it("blocks while a target switch is pending", () => {
    expect(
      getReviewSubmitBlock({
        isPending: false,
        hasPendingTarget: true,
        blocker: null,
      }),
    ).toBe("target-switching");
  });

  it("blocks when media is not ready", () => {
    expect(
      getReviewSubmitBlock({
        isPending: false,
        hasPendingTarget: false,
        blocker: "failed-media",
      }),
    ).toBe("media-not-ready");
  });

  it("allows submission when nothing blocks", () => {
    expect(
      getReviewSubmitBlock({
        isPending: false,
        hasPendingTarget: false,
        blocker: null,
      }),
    ).toBeNull();
  });
});
