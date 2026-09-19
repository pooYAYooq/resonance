import { renderHook } from "@testing-library/react";
import { useMutation } from "convex/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInlineImageUpload } from "./use-inline-image-upload";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("passes through safe absolute media URLs for native embeds", async () => {
    const { result } = renderHook(() => useInlineImageUpload());
    await expect(
      result.current.resolveFileUrl("https://cdn.example/pic.png"),
    ).resolves.toBe("https://cdn.example/pic.png");
    await expect(
      result.current.resolveFileUrl("http://cdn.example/clip.mp4"),
    ).resolves.toBe("http://cdn.example/clip.mp4");
  });

  it("does not pass through relative or unsafe media values", async () => {
    const { result } = renderHook(() => useInlineImageUpload());
    await expect(
      result.current.resolveFileUrl("javascript:alert(1)"),
    ).resolves.toBe("");
    await expect(
      result.current.resolveFileUrl("storage-with-no-url"),
    ).resolves.toBe("");
  });

  it("revokes an object URL created after the hook unmounts", async () => {
    const createPendingUpload = vi.fn().mockResolvedValue({
      sessionId: "session123",
      uploadUrl: "https://upload.example",
    });
    const cleanupPending = vi.fn();
    const finalizePendingUpload = vi.fn().mockResolvedValue({ accepted: true });
    vi.mocked(useMutation)
      .mockImplementationOnce(() => createPendingUpload as never)
      .mockImplementationOnce(() => cleanupPending as never)
      .mockImplementationOnce(() => finalizePendingUpload as never);

    const createObjectURL = vi.fn(() => "blob:inline-image");
    const revokeObjectURL = vi.fn();
    const onUploadSessionCreated = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const fetchPromise = Promise.resolve({
      ok: true,
      json: async () => ({ storageId: "storage123" }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => fetchPromise),
    );

    const { result, unmount } = renderHook(() =>
      useInlineImageUpload({ onUploadSessionCreated }),
    );
    const uploadPromise = result.current.uploadFile(
      new File(["image"], "image.png", { type: "image/png" }),
    );
    unmount();

    await expect(uploadPromise).resolves.toBe("storage123");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:inline-image");
    expect(onUploadSessionCreated).not.toHaveBeenCalled();
  });
});
