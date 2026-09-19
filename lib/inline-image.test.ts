import { describe, expect, it } from "vitest";
import { isAllowedBlockNoteFile } from "./inline-image";

describe("BlockNote media upload policy", () => {
  it.each([
    "image/jpeg",
    "image/png",
    "image/webp",
    "audio/mpeg",
    "video/mp4",
    "application/pdf",
  ])("allows standard BlockNote file type %s", (type) => {
    expect(isAllowedBlockNoteFile(type)).toBe(true);
  });

  it.each(["text/html", "application/javascript", "application/x-msdownload"])(
    "rejects unsafe file type %s",
    (type) => {
      expect(isAllowedBlockNoteFile(type)).toBe(false);
    },
  );
});
