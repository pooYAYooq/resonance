import { describe, expect, it } from "vitest";
import {
  collectPendingMediaIds,
  sanitizePastedBlocks,
  type PastedBlock,
} from "./paste-sanitize";

describe("sanitizePastedBlocks", () => {
  it("normalizes copied webpage colors and alignment onto supported tokens", () => {
    const result = sanitizePastedBlocks([
      {
        id: "block-1",
        type: "paragraph",
        props: {
          backgroundColor: "rgb(255, 255, 255)",
          textColor: "#333333",
          textAlignment: "start",
        },
        content: [
          {
            type: "text",
            text: "Copied prose",
            styles: { textColor: "rgb(51, 51, 51)", bold: true },
          },
          {
            type: "link",
            href: "https://example.com",
            content: [
              {
                type: "text",
                text: "link",
                styles: { backgroundColor: "rgba(0, 0, 0, 0.1)" },
              },
            ],
          },
        ],
      },
    ]);

    expect(result.changedBlockIds).toEqual(["block-1"]);
    expect(result.blocks[0].props).toEqual({
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
    });
    expect(result.blocks[0].content).toEqual([
      {
        type: "text",
        text: "Copied prose",
        styles: { textColor: "default", bold: true },
      },
      {
        type: "link",
        href: "https://example.com",
        content: [
          {
            type: "text",
            text: "link",
            styles: { backgroundColor: "default" },
          },
        ],
      },
    ]);
    expect(result.droppedMediaCount).toBe(0);
  });

  it("keeps palette colors and alignments unchanged on a second pass", () => {
    const input: PastedBlock[] = [
      {
        id: "block-1",
        type: "heading",
        props: {
          level: 2,
          textColor: "blue",
          backgroundColor: "default",
          textAlignment: "end",
        },
        content: [
          { type: "text", text: "Heading", styles: { textColor: "red" } },
        ],
      },
    ];

    const first = sanitizePastedBlocks(input);
    expect(first.changedBlockIds).toEqual(["block-1"]);
    expect(first.blocks[0].props).toEqual({
      level: 2,
      textColor: "blue",
      backgroundColor: "default",
      textAlignment: "right",
    });

    const second = sanitizePastedBlocks(first.blocks);
    expect(second.changedBlockIds).toEqual([]);
    expect(second.blocks).toEqual(first.blocks);
  });

  it("drops media with unstorable sources and keeps storable media", () => {
    const result = sanitizePastedBlocks([
      {
        id: "image-data",
        type: "image",
        props: { url: "data:image/png;base64,abc" },
      },
      {
        id: "video-blob",
        type: "video",
        props: { url: "blob:https://example.com/1234" },
      },
      {
        id: "audio-cid",
        type: "audio",
        props: { url: "cid:inline-image" },
      },
      {
        id: "image-remote",
        type: "image",
        props: { url: "https://example.com/picture.png" },
      },
      {
        id: "image-storage",
        type: "image",
        props: { url: "storage-id-1" },
      },
      {
        id: "paragraph",
        type: "paragraph",
        content: [{ type: "text", text: "Kept prose" }],
      },
    ]);

    expect(result.droppedMediaCount).toBe(3);
    expect(result.droppedMediaIds).toEqual([
      "image-data",
      "video-blob",
      "audio-cid",
    ]);
    expect(result.blocks.map((block) => block.id)).toEqual([
      "image-remote",
      "image-storage",
      "paragraph",
    ]);
  });

  it("removes dropped media from nested children in the sanitized copy", () => {
    const result = sanitizePastedBlocks([
      {
        id: "list-1",
        type: "bulletListItem",
        content: [{ type: "text", text: "Parent" }],
        children: [
          {
            id: "child-image",
            type: "image",
            props: { url: "data:image/png;base64,abc" },
          },
        ],
      },
    ]);

    expect(result.droppedMediaIds).toEqual(["child-image"]);
    expect(result.blocks[0].children).toEqual([]);
    expect(result.blocks[0]).toMatchObject({
      content: [{ type: "text", text: "Parent" }],
    });
  });

  it("drops media blocks with empty, missing, or malformed sources", () => {
    const result = sanitizePastedBlocks([
      { id: "image-empty", type: "image", props: { url: "" } },
      { id: "video-blank", type: "video", props: { url: "   " } },
      { id: "audio-no-props", type: "audio", props: {} },
      { id: "image-no-props", type: "image" },
      {
        id: "image-empty-url-source",
        type: "image",
        props: { source: { kind: "url", url: "" } },
      },
      {
        id: "image-empty-storage",
        type: "image",
        props: { source: { kind: "storage", id: "  " } },
      },
      {
        id: "image-unknown-source",
        type: "image",
        props: { source: { kind: "mystery" } },
      },
      {
        id: "paragraph",
        type: "paragraph",
        content: [{ type: "text", text: "Kept prose" }],
      },
    ]);

    expect(result.droppedMediaCount).toBe(7);
    expect(result.droppedMediaIds).toEqual([
      "image-empty",
      "video-blank",
      "audio-no-props",
      "image-no-props",
      "image-empty-url-source",
      "image-empty-storage",
      "image-unknown-source",
    ]);
    expect(result.blocks.map((block) => block.id)).toEqual(["paragraph"]);
  });

  it("keeps media blocks that may still be uploading", () => {
    const result = sanitizePastedBlocks(
      [
        {
          id: "uploading",
          type: "image",
          props: { url: "", name: "photo.png" },
        },
        { id: "foreign", type: "image", props: { url: "" } },
      ],
      { pendingMediaIds: new Set(["uploading"]) },
    );

    expect(result.droppedMediaIds).toEqual(["foreign"]);
    expect(result.droppedMediaCount).toBe(1);
    expect(result.blocks.map((block) => block.id)).toEqual(["uploading"]);
  });

  it("collects ids of media blocks with empty or missing sources", () => {
    const ids = collectPendingMediaIds([
      { id: "empty-image", type: "image", props: { url: "" } },
      { id: "blank-video", type: "video", props: { url: "  " } },
      {
        id: "remote-image",
        type: "image",
        props: { url: "https://example.com/a.png" },
      },
      {
        id: "parent-list",
        type: "bulletListItem",
        props: { textColor: "default" },
        content: [{ type: "text", text: "Parent" }],
        children: [{ id: "child-audio", type: "audio", props: {} }],
      },
    ]);
    expect(ids).toBeInstanceOf(Set);
    expect([...ids].sort()).toEqual(
      ["child-audio", "empty-image", "blank-video"].sort(),
    );
  });

  it("sanitizes table cells and nested children while keeping their text", () => {
    const result = sanitizePastedBlocks([
      {
        id: "table-1",
        type: "table",
        content: {
          type: "tableContent",
          columnWidths: [null],
          rows: [
            {
              cells: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "text",
                      text: "Cell text",
                      styles: { textColor: "rgb(1, 1, 1)" },
                    },
                  ],
                  props: {
                    colspan: 1,
                    rowspan: 1,
                    backgroundColor: "#ffffff",
                    textColor: "default",
                    textAlignment: "start",
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: "parent-1",
        type: "bulletListItem",
        props: { textColor: "rgb(0, 0, 0)" },
        content: [{ type: "text", text: "Parent" }],
        children: [
          {
            id: "child-1",
            type: "bulletListItem",
            props: { textAlignment: "end" },
            content: [{ type: "text", text: "Child" }],
          },
        ],
      },
    ]);

    expect(result.changedBlockIds).toEqual(
      expect.arrayContaining(["table-1", "parent-1", "child-1"]),
    );
    expect(result.changedBlockIds).toHaveLength(3);
    const table = result.blocks[0];
    const cell = (
      table.content as {
        rows: { cells: { content: unknown; props: unknown }[] }[];
      }
    ).rows[0].cells[0];
    expect(cell.props).toEqual({
      colspan: 1,
      rowspan: 1,
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
    });
    expect(cell.content).toEqual([
      { type: "text", text: "Cell text", styles: { textColor: "default" } },
    ]);
    expect(result.blocks[1].props).toEqual({ textColor: "default" });
    expect(result.blocks[1].children?.[0].props).toEqual({
      textAlignment: "right",
    });
    expect(result.blocks[1].children?.[0]).toMatchObject({
      content: [{ type: "text", text: "Child" }],
    });
  });

  it("maps every unsupported color and alignment value to a supported one", () => {
    const unsupportedColors = [
      "#333333",
      "rgb(51, 51, 51)",
      "rgba(0, 0, 0, 0.5)",
      "hsl(210, 10%, 20%)",
      "currentcolor",
      "inherit",
      42,
      null,
    ];
    const unsupportedAlignments = ["start", "end", "match-parent", "center "];
    const result = sanitizePastedBlocks([
      {
        id: "block-1",
        type: "paragraph",
        props: {
          backgroundColor: unsupportedColors[0],
          textColor: unsupportedColors[1],
          textAlignment: "start",
        },
        content: [
          {
            type: "text",
            text: "Text",
            styles: {
              textColor: unsupportedColors[2],
              backgroundColor: "not-a-token",
            },
          },
        ],
      },
      ...unsupportedColors.slice(3).map((value, index) => ({
        id: `block-${index + 2}`,
        type: "paragraph",
        props: { textColor: value },
        content: [{ type: "text", text: "Text" }],
      })),
      ...unsupportedAlignments.map((value, index) => ({
        id: `aligned-${index}`,
        type: "paragraph",
        props: { textAlignment: value },
        content: [{ type: "text", text: "Text" }],
      })),
    ]);

    for (const block of result.blocks) {
      const props = block.props ?? {};
      if ("textColor" in props) expect(props.textColor).toBe("default");
      if ("backgroundColor" in props)
        expect(props.backgroundColor).toBe("default");
      if ("textAlignment" in props) {
        expect(["left", "right"]).toContain(props.textAlignment);
      }
      const content = block.content as
        | { styles?: Record<string, unknown> }[]
        | undefined;
      for (const inline of content ?? []) {
        if (inline.styles?.textColor)
          expect(inline.styles.textColor).toBe("default");
        if (inline.styles?.backgroundColor) {
          expect(inline.styles.backgroundColor).toBe("default");
        }
      }
    }
    expect(result.changedBlockIds).toHaveLength(result.blocks.length);
  });
});
