import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInlineImageUpload } from "./use-inline-image-upload";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

describe("useInlineImageUpload", () => {
  it("returns uploadFile and resolveFileUrl functions", () => {
    const { result } = renderHook(() => useInlineImageUpload());
    expect(typeof result.current.uploadFile).toBe("function");
    expect(typeof result.current.resolveFileUrl).toBe("function");
  });

  it("resolves a resolvedImageUrls fallback when no object URL exists", async () => {
    const { result } = renderHook(() =>
      useInlineImageUpload({
        resolvedImageUrls: { storage123: "https://cdn.example/image.png" },
      }),
    );
    await expect(result.current.resolveFileUrl("storage123")).resolves.toBe(
      "https://cdn.example/image.png",
    );
  });

  it("resolves to an empty string when no URL is known", async () => {
    const { result } = renderHook(() => useInlineImageUpload());
    await expect(result.current.resolveFileUrl("unknown")).resolves.toBe("");
  });
});
