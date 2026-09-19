import { describe, expect, it } from "vitest";
import {
  BLOCKNOTE_FORMAT,
  extractImageStorageIds,
  isValidBlockNoteDoc,
  parsePostBody,
} from "./post-content";

describe("post content persistence seam", () => {
  it("parses a full BlockNote envelope into canonical defaults", () => {
    const parsed = parsePostBody(
      JSON.stringify({
        format: BLOCKNOTE_FORMAT,
        blocks: [
          {
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Article heading" }],
            children: [],
          },
          {
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: "Body" }],
            children: [],
          },
        ],
      }),
    );

    expect(parsed.kind).toBe("structured");
    if (parsed.kind !== "structured") return;
    expect(parsed.document.blocks[0]?.props).toMatchObject({
      level: 2,
      textAlignment: "left",
    });
  });

  it("rejects unknown block props and unsafe links", () => {
    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          props: { executable: "no" },
          content: [{ type: "text", text: "no" }],
        },
      ]),
    ).toBe(false);
    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          props: {},
          content: [
            {
              type: "link",
              href: "javascript:alert(1)",
              content: [{ type: "text", text: "no" }],
            },
          ],
        },
      ]),
    ).toBe(false);
  });

  it("extracts each canonical local media reference once", () => {
    const parsed = parsePostBody(
      JSON.stringify({
        format: BLOCKNOTE_FORMAT,
        blocks: [
          {
            type: "image",
            props: { url: "storage-image", name: "image.png" },
            children: [],
          },
          {
            type: "audio",
            props: { url: "storage-audio", name: "audio.mp3" },
            children: [],
          },
          {
            type: "video",
            props: {
              url: "https://cdn.example.com/video.mp4",
              name: "video.mp4",
            },
            children: [],
          },
        ],
      }),
    );

    expect(parsed.kind).toBe("structured");
    if (parsed.kind !== "structured") return;
    expect(extractImageStorageIds(parsed.document.blocks)).toEqual([
      "storage-image",
      "storage-audio",
    ]);
  });

  it("normalizes an unknown code language to plain text", () => {
    const parsed = parsePostBody(
      JSON.stringify({
        format: BLOCKNOTE_FORMAT,
        blocks: [
          { type: "codeBlock", props: { language: "unknown" }, content: "x" },
        ],
      }),
    );

    expect(parsed).toMatchObject({
      kind: "structured",
      document: { blocks: [{ props: { language: "text" } }] },
    });
  });
});
