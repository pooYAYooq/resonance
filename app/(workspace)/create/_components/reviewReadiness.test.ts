import { describe, expect, it } from "vitest";
import {
  getCoverRecoveryBlocker,
  getCoverPublicationBlocker,
  getHydratedCoverRecovery,
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

describe("getCoverPublicationBlocker", () => {
  it.each([
    ["empty", "image/png", 0],
    ["GIF", "image/gif", 1],
    ["SVG", "image/svg+xml", 1],
    ["AVIF", "image/avif", 1],
    ["unknown MIME", "", 1],
    ["oversized", "image/png", 5 * 1024 * 1024 + 1],
  ])(
    "blocks a selected %s cover instead of falling back to a saved cover",
    (_, type, size) => {
      const blocker = getCoverPublicationBlocker({
        removed: false,
        existingStorageId: "saved",
        selectedFile: new File([new Uint8Array(size)], "cover", { type }),
      });
      expect(blocker).toBe("cover-invalid");
      expect(
        getReviewSubmitBlock({
          isPending: false,
          hasPendingTarget: false,
          blocker,
        }),
      ).toBe("media-not-ready");
    },
  );

  it.each(["image/jpeg", "image/png", "image/webp"])(
    "allows a nonempty %s cover at the size limit",
    (type) => {
      expect(
        getCoverPublicationBlocker({
          removed: false,
          selectedFile: new File([new Uint8Array(5 * 1024 * 1024)], "cover", {
            type,
          }),
        }),
      ).toBeNull();
    },
  );
  it("requires a cover while allowing a selected local file before upload", () => {
    expect(getCoverPublicationBlocker({ removed: false })).toBe(
      "cover-required",
    );
    expect(
      getCoverPublicationBlocker({ removed: true, existingStorageId: "saved" }),
    ).toBe("cover-required");
    expect(
      getCoverPublicationBlocker({
        removed: false,
        existingStorageId: "saved",
      }),
    ).toBeNull();
    expect(
      getCoverPublicationBlocker({
        removed: false,
        selectedFile: new File(["cover"], "cover.png", { type: "image/png" }),
      }),
    ).toBeNull();
  });
});

describe("getHydratedCoverRecovery", () => {
  it("marks a stored cover with no resolved URL as failed", () => {
    expect(getHydratedCoverRecovery("cover-1", null)).toBe("failed");
    expect(getHydratedCoverRecovery("cover-1", undefined)).toBe("failed");
  });

  it("leaves a resolved or absent stored cover ready", () => {
    expect(getHydratedCoverRecovery("cover-1", "https://cover")).toBeNull();
    expect(getHydratedCoverRecovery(undefined, null)).toBeNull();
    expect(getHydratedCoverRecovery(null, null)).toBeNull();
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

describe("getCoverRecoveryBlocker", () => {
  it("blocks while a recovered cover is resolving", () => {
    expect(getCoverRecoveryBlocker("resolving")).toBe("cover-resolving");
  });

  it("blocks when a recovered cover could not be loaded", () => {
    expect(getCoverRecoveryBlocker("failed")).toBe("cover-load-failed");
  });

  it("does not block without a recovery hold", () => {
    expect(getCoverRecoveryBlocker(null)).toBeNull();
    expect(getCoverRecoveryBlocker(undefined)).toBeNull();
  });

  it("keeps the cover-recovery submit blocker inside the shared union", () => {
    expect(
      getReviewSubmitBlock({
        isPending: false,
        hasPendingTarget: false,
        blocker: "cover-resolving",
      }),
    ).toBe("media-not-ready");
    expect(
      getReviewSubmitBlock({
        isPending: false,
        hasPendingTarget: false,
        blocker: "cover-load-failed",
      }),
    ).toBe("media-not-ready");
  });

  it("uses author-facing copy for both cover recovery states", () => {
    expect(REVIEW_BLOCKER_MESSAGES["cover-resolving"]).toBe(
      "Loading your saved cover. Review will be available when it finishes.",
    );
    expect(REVIEW_BLOCKER_MESSAGES["cover-load-failed"]).toBe(
      "Your saved cover could not be loaded. Replace it to continue to Review. You can remove it and save a draft instead.",
    );
  });
});
