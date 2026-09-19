import { describe, expect, it } from "vitest";
import {
  extractStorageMediaIds,
  normalizeBlockNoteDocument,
} from "./blocknote-contract";
import { MAX_POST_BLOCKS } from "./post-capacity";

describe("blocknote contract", () => {
  it("normalizes heading levels recursively and rejects toggle heading props", () => {
    const blocks = [1, 2, 3, 4, 5, 6, 7, undefined, "3", 2.5].map((level) => ({
      type: "heading",
      props: { level },
      content: [{ type: "text", text: "Heading" }],
      children: [
        {
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: "Nested" }],
        },
      ],
    }));
    const result = normalizeBlockNoteDocument({
      format: "blocknote@1",
      blocks,
    });
    expect(result?.blocks.map((block) => block.props?.level)).toEqual([
      2, 2, 3, 4, 5, 6, 6, 2, 2, 2,
    ]);
    expect(result?.blocks[0].children?.[0].props?.level).toBe(2);
    expect(
      normalizeBlockNoteDocument({
        format: "blocknote@1",
        blocks: [
          {
            type: "heading",
            props: { level: 2, isToggleable: false },
            content: [{ type: "text", text: "No toggles" }],
          },
        ],
      }),
    ).toBeNull();
  });
  it("accepts the installed default document blocks and presentation props", () => {
    const document = normalizeBlockNoteDocument({
      format: "blocknote@1",
      blocks: [
        {
          type: "paragraph",
          props: {
            backgroundColor: "yellow",
            textColor: "blue",
            textAlignment: "center",
          },
          content: [
            {
              type: "text",
              text: "A styled paragraph",
              styles: { bold: true, textColor: "red" },
            },
          ],
          children: [],
        },
        {
          type: "checkListItem",
          props: { checked: true },
          content: [],
          children: [],
        },
        { type: "toggleListItem", props: {}, content: [], children: [] },
        { type: "divider", props: {}, children: [] },
        {
          type: "image",
          props: {
            url: "storage-image-1",
            name: "lake.jpg",
            caption: "Morning light",
            showPreview: true,
            previewWidth: 500,
            textAlignment: "center",
          },
          children: [],
        },
        {
          type: "audio",
          props: {
            url: "https://cdn.example.com/audio.mp3",
            name: "audio.mp3",
          },
          children: [],
        },
      ],
    });

    expect(document).not.toBeNull();
    expect(extractStorageMediaIds(document?.blocks ?? [])).toEqual([
      "storage-image-1",
    ]);
  });

  it("rejects unsafe links, unsafe remote media, and unknown properties", () => {
    expect(
      normalizeBlockNoteDocument({
        format: "blocknote@1",
        blocks: [
          {
            type: "paragraph",
            props: {},
            content: [
              {
                type: "link",
                href: "javascript:alert(1)",
                content: [{ type: "text", text: "unsafe" }],
              },
            ],
            children: [],
          },
        ],
      }),
    ).toBeNull();

    expect(
      normalizeBlockNoteDocument({
        format: "blocknote@1",
        blocks: [
          {
            type: "image",
            props: { url: "javascript:alert(1)", name: "unsafe" },
            children: [],
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects standalone file blocks", () => {
    expect(
      normalizeBlockNoteDocument({
        format: "blocknote@1",
        blocks: [
          {
            type: "file",
            props: { url: "storage-file", name: "notes.pdf" },
            children: [],
          },
        ],
      }),
    ).toBeNull();
  });

  it("accepts native undefined table column widths as unset", () => {
    const document = normalizeBlockNoteDocument({
      format: "blocknote@1",
      blocks: [
        {
          type: "table",
          props: { textColor: "default" },
          content: {
            type: "tableContent",
            columnWidths: [undefined, null, 240],
            rows: [
              {
                cells: [
                  {
                    type: "tableCell",
                    content: [{ type: "text", text: "Cell", styles: {} }],
                    props: {
                      colspan: 1,
                      rowspan: 1,
                      backgroundColor: "default",
                      textColor: "default",
                      textAlignment: "left",
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(
      (document?.blocks[0].content as { columnWidths?: unknown[] })
        ?.columnWidths,
    ).toEqual([null, null, 240]);
  });

  it("rejects deeply nested documents without overflowing the stack", () => {
    const leaf: Record<string, unknown> = {
      type: "paragraph",
      props: {},
      content: [],
    };
    let nested = leaf;
    for (let index = 0; index < 50_000; index += 1) {
      nested = {
        type: "paragraph",
        props: {},
        content: [],
        children: [nested],
      };
    }

    const document = { format: "blocknote@1", blocks: [nested] };
    expect(() => normalizeBlockNoteDocument(document)).not.toThrow();
    expect(normalizeBlockNoteDocument(document)).toBeNull();
  });

  it("rejects a document with more top-level blocks than the limit", () => {
    const blocks = Array.from({ length: MAX_POST_BLOCKS + 1 }, () => ({
      type: "paragraph",
      props: {},
      content: [],
    }));

    expect(
      normalizeBlockNoteDocument({ format: "blocknote@1", blocks }),
    ).toBeNull();
  });

  it("rejects deeply nested inline link content without overflowing", () => {
    let inline: Record<string, unknown> = { type: "text", text: "x" };
    for (let index = 0; index < 5_000; index += 1) {
      inline = { type: "link", href: "https://example.com", content: [inline] };
    }
    const document = {
      format: "blocknote@1",
      blocks: [{ type: "paragraph", props: {}, content: [inline] }],
    };

    expect(() => normalizeBlockNoteDocument(document)).not.toThrow();
    expect(normalizeBlockNoteDocument(document)).toBeNull();
  });

  it("rejects a non-positive media preview width", () => {
    const document = {
      format: "blocknote@1",
      blocks: [
        {
          type: "image",
          props: {
            url: "https://cdn.example.com/pic.png",
            name: "pic.png",
            caption: "",
            backgroundColor: "default",
            textAlignment: "left",
            previewWidth: 0,
          },
        },
      ],
    };

    expect(normalizeBlockNoteDocument(document)).toBeNull();
  });
});
