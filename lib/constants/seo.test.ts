import { describe, expect, it } from "vitest";
import { boundProfileDescription } from "./seo";

describe("boundProfileDescription", () => {
  it("falls back to the author tagline when the bio is empty", () => {
    expect(boundProfileDescription(null, "Ada Lovelace")).toBe(
      "Posts by Ada Lovelace on Resonance.",
    );
    expect(boundProfileDescription("", "Ada Lovelace")).toBe(
      "Posts by Ada Lovelace on Resonance.",
    );
    expect(boundProfileDescription("   \n\t ", "Ada Lovelace")).toBe(
      "Posts by Ada Lovelace on Resonance.",
    );
  });

  it("collapses internal whitespace and trims the bio", () => {
    expect(boundProfileDescription("  multi   line\n\nbio \t", "Ada")).toBe(
      "multi line bio",
    );
  });

  it("bounds a plain ASCII bio to 160 code points", () => {
    const bio = "a".repeat(200);
    expect(boundProfileDescription(bio, "Ada")).toBe("a".repeat(160));
  });

  it("truncates by code points without splitting an astral character", () => {
    const bio = "a".repeat(159) + "😀" + "trailing text";
    const result = boundProfileDescription(bio, "Ada");

    expect(Array.from(result)).toHaveLength(160);
    expect(result.endsWith("😀")).toBe(true);
    expect(result).toBe("a".repeat(159) + "😀");
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(result)).toBe(false);
    expect(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(result)).toBe(false);
  });
});
