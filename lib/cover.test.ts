import { describe, expect, it } from "vitest";
import { resolveCoverUrl } from "./cover";

describe("resolveCoverUrl", () => {
  it("returns a trimmed custom URL", () => {
    expect(resolveCoverUrl("  https://cdn.example/cover.png  ")).toBe(
      "https://cdn.example/cover.png",
    );
  });

  it("returns null for null, undefined, empty, and whitespace", () => {
    expect(resolveCoverUrl(null)).toBeNull();
    expect(resolveCoverUrl(undefined)).toBeNull();
    expect(resolveCoverUrl("")).toBeNull();
    expect(resolveCoverUrl("   ")).toBeNull();
  });
});
