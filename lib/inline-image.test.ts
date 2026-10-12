import { describe, expect, it } from "vitest";
import { hasImageSignature, isAllowedBlockNoteFile } from "./inline-image";

describe("BlockNote media upload policy", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "audio/mpeg", "video/mp4"])(
    "allows standard BlockNote file type %s",
    (type) => {
      expect(isAllowedBlockNoteFile(type)).toBe(true);
    },
  );

  it.each([
    "text/html",
    "application/javascript",
    "application/x-msdownload",
    "application/pdf",
    "text/plain",
    "text/csv",
    "video/x-flv",
    "audio/x-ms-wma",
  ])("rejects unsafe file type %s", (type) => {
    expect(isAllowedBlockNoteFile(type)).toBe(false);
  });
});

describe("hasImageSignature", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  it("accepts bytes that match the declared image type", () => {
    expect(hasImageSignature("image/png", png)).toBe(true);
    expect(hasImageSignature("image/jpeg", jpeg)).toBe(true);
    expect(hasImageSignature("image/webp", webp)).toBe(true);
  });

  it("rejects bytes that do not match the declared image type", () => {
    expect(hasImageSignature("image/png", jpeg)).toBe(false);
    expect(hasImageSignature("image/jpeg", png)).toBe(false);
    expect(hasImageSignature("image/webp", png)).toBe(false);
  });

  it("rejects a renamed or empty payload labelled as an image", () => {
    const text = new Uint8Array([0x6e, 0x6f, 0x74, 0x20, 0x61, 0x6e]);
    expect(hasImageSignature("image/png", text)).toBe(false);
    expect(hasImageSignature("image/png", new Uint8Array())).toBe(false);
  });

  it("does not treat a declared non-image type as an image signature", () => {
    expect(hasImageSignature("audio/mpeg", jpeg)).toBe(false);
    expect(hasImageSignature(undefined, png)).toBe(false);
  });
});
