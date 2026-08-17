import { describe, it, expect } from "vitest";
import {
  BLOCKNOTE_FORMAT,
  MAX_BLOCKS,
  MAX_CHILDREN_PER_BLOCK,
  MAX_INLINE_NODES,
  MAX_POST_TEXT_LENGTH,
  MAX_RECURSION_DEPTH,
  extractImageStorageIds,
  extractPlainText,
  isValidBlockNoteDoc,
  parsePostBody,
} from "./post-content";
import type {
  BlockNoteDocument,
  PostBlock,
  PostImageProps,
} from "./post-content";

const structured = {
  format: "blocknote@1",
  blocks: [
    {
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: "Heading", styles: { bold: true } }],
    },
    {
      type: "bulletListItem",
      content: [
        {
          type: "link",
          href: "https://example.com",
          content: [{ type: "text", text: "link" }],
        },
      ],
      children: [
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "nested" }],
        },
      ],
    },
    { type: "quote", content: [{ type: "text", text: "quote" }] },
    { type: "codeBlock", props: { language: "ts" }, content: "const x = 1;" },
  ],
} satisfies BlockNoteDocument;

describe("parsePostBody", () => {
  it("parses structured and legacy posts", () => {
    expect(parsePostBody(JSON.stringify(structured))).toEqual({
      kind: "structured",
      document: structured,
    });
    expect(parsePostBody("old\nplain post")).toEqual({
      kind: "legacy",
      text: "old\nplain post",
    });
    expect(parsePostBody("{")).toEqual({ kind: "legacy", text: "{" });
    expect(
      parsePostBody(JSON.stringify({ format: "other@1", blocks: [] })),
    ).toMatchObject({ kind: "legacy" });
  });

  it("distinguishes an invalid structured envelope from legacy text", () => {
    expect(
      parsePostBody(
        JSON.stringify({
          format: BLOCKNOTE_FORMAT,
          blocks: [{ type: "image", props: {} }],
        }),
      ),
    ).toMatchObject({ kind: "invalid" });
  });

  it("treats JSON primitives and non-BlockNote envelopes as legacy text", () => {
    expect(parsePostBody("null")).toEqual({ kind: "legacy", text: "null" });
    expect(parsePostBody("42")).toEqual({ kind: "legacy", text: "42" });
    expect(parsePostBody("[1,2,3]")).toEqual({
      kind: "legacy",
      text: "[1,2,3]",
    });
    expect(parsePostBody('"just a string"')).toEqual({
      kind: "legacy",
      text: '"just a string"',
    });
  });

  it("rejects incomplete BlockNote envelopes", () => {
    expect(parsePostBody(JSON.stringify({ format: BLOCKNOTE_FORMAT }))).toEqual(
      {
        kind: "invalid",
      },
    );
    expect(
      parsePostBody(
        JSON.stringify({ format: BLOCKNOTE_FORMAT, blocks: "not an array" }),
      ),
    ).toEqual({ kind: "invalid" });
  });
});

describe("post content types", () => {
  it("keeps generic block props indexable while modeling image props", () => {
    const heading: PostBlock = {
      type: "heading",
      props: { level: 2 },
    };
    const image: PostImageProps = {
      storageId: "storage-1",
      altText: "A descriptive image",
    };

    expect(heading.props?.level).toBe(2);
    expect(image.storageId).toBe("storage-1");
  });
});

describe("extractPlainText", () => {
  it("extract plain text from structured post", () => {
    expect(extractPlainText(structured.blocks)).toContain("Heading");
    expect(extractPlainText(structured.blocks)).toContain("link");
    expect(extractPlainText(structured.blocks)).toContain("nested");
    expect(extractPlainText(structured.blocks)).toContain("quote");
    expect(extractPlainText(structured.blocks)).toContain("const x = 1;");
  });

  it("extracts nested link text without trusting the link URL", () => {
    const blocks: PostBlock[] = [
      {
        type: "paragraph",
        content: [
          {
            type: "link",
            href: "javascript:alert(1)",
            content: [{ type: "text", text: "safe label" }],
          },
        ],
      },
    ];

    const text = extractPlainText(blocks);

    expect(text).toContain("safe label");
    expect(text).not.toContain("javascript:");
  });

  it("uses readable separators without serialized markup", () => {
    const text = extractPlainText([
      { type: "paragraph", content: [{ type: "text", text: "first" }] },
      { type: "paragraph", content: [{ type: "text", text: "second" }] },
    ]);

    expect(text).toMatch(/first\s+second/);
    expect(text).not.toContain("format");
    expect(text).not.toContain("blocks");
  });

  it("does not extract text beyond the maximum recursion depth", () => {
    let block: PostBlock = {
      type: "paragraph",
      content: [{ type: "text", text: "too deep" }],
    };

    for (let depth = 0; depth <= MAX_RECURSION_DEPTH; depth += 1) {
      block = {
        type: "bulletListItem",
        content: [{ type: "text", text: "level" }],
        children: [block],
      };
    }

    const text = extractPlainText([block]);

    expect(text).toContain("level");
    expect(text).not.toContain("too deep");
  });

  it("extracts image captions but not alt text", () => {
    const text = extractPlainText([
      {
        type: "image",
        props: {
          storageId: "storage-1",
          altText: "descriptive alt text",
          caption: "A readable caption",
        },
      },
    ]);

    expect(text).toBe("A readable caption");
    expect(text).not.toContain("descriptive alt text");
  });
});

describe("isValidBlockNoteDoc", () => {
  it("accepts every supported block type", () => {
    expect(
      isValidBlockNoteDoc([
        { type: "paragraph", content: [{ type: "text", text: "paragraph" }] },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "heading" }],
        },
        { type: "quote", content: [{ type: "text", text: "quote" }] },
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "bullet" }],
        },
        {
          type: "numberedListItem",
          content: [{ type: "text", text: "numbered" }],
        },
        {
          type: "codeBlock",
          props: { language: "ts" },
          content: "const value = 1;",
        },
        {
          type: "image",
          props: { storageId: "storage-1", altText: "A diagram" },
        },
      ]),
    ).toBe(true);
  });

  it("accepts links with nested styled text, link styles, and implicit text nodes", () => {
    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          content: [
            { text: "implicit text node" },
            {
              type: "link",
              href: "https://example.com",
              styles: { bold: true },
              content: [
                { type: "text", text: "styled link", styles: { italic: true } },
              ],
            },
          ],
        },
      ]),
    ).toBe(true);
  });

  it("rejects extra block, inline, and props keys", () => {
    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          id: "block-id",
          content: [{ type: "text", text: "text" }],
        },
      ]),
    ).toBe(false);
    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          content: [{ type: "text", id: "inline-id", text: "text" }],
        },
      ]),
    ).toBe(false);
    expect(
      isValidBlockNoteDoc([
        {
          type: "heading",
          props: { level: 2, anchor: "heading-anchor" },
          content: [{ type: "text", text: "heading" }],
        },
      ]),
    ).toBe(false);
    expect(
      isValidBlockNoteDoc([
        {
          type: "codeBlock",
          props: { language: "ts", theme: "dark" },
          content: "code",
        },
      ]),
    ).toBe(false);
  });

  it("rejects malformed inline and link content", () => {
    const invalidContent = [
      [{ type: "link", content: [{ type: "text", text: "missing href" }] }],
      [
        {
          type: "link",
          href: 42,
          content: [{ type: "text", text: "non-string href" }],
        },
      ],
      [
        {
          type: "link",
          href: "https://example.com",
          text: "stray text",
          content: [{ type: "text", text: "link" }],
        },
      ],
      [{ type: "link", href: "https://example.com", content: "not an array" }],
      [{ type: "text", text: "text", href: "https://example.com" }],
      [{ type: "text", text: "text", content: [] }],
      [{ type: "mention", text: "unknown inline type" }],
      ["not an inline record"],
    ];

    for (const content of invalidContent) {
      expect(isValidBlockNoteDoc([{ type: "paragraph", content }])).toBe(false);
    }

    expect(
      isValidBlockNoteDoc([{ type: "paragraph", content: "not an array" }]),
    ).toBe(false);
  });

  it("accepts an empty blocks array structurally", () => {
    // The readable minimum is enforced at write boundaries.
    expect(isValidBlockNoteDoc([])).toBe(true);
  });

  it("rejects unsupported block types", () => {
    for (const type of [
      "video",
      "audio",
      "file",
      "table",
      "checkListItem",
      "toggleListItem",
      "unknownBlock",
    ]) {
      expect(
        isValidBlockNoteDoc([
          { type, content: [{ type: "text", text: "unsupported" }] },
        ]),
      ).toBe(false);
    }
  });

  it("rejects images with missing, blank, or non-string required props", () => {
    for (const props of [
      { storageId: "storage-1" },
      { storageId: "storage-1", altText: "   " },
      { storageId: "storage-1", altText: 42 },
      { altText: "A diagram" },
      { storageId: "   ", altText: "A diagram" },
      { storageId: 42, altText: "A diagram" },
    ]) {
      expect(isValidBlockNoteDoc([{ type: "image", props }])).toBe(false);
    }

    expect(isValidBlockNoteDoc([{ type: "image" }])).toBe(false);
  });

  it("rejects unknown image props and image content or children", () => {
    const validProps = { storageId: "storage-1", altText: "A diagram" };

    expect(
      isValidBlockNoteDoc([
        { type: "image", props: { ...validProps, width: 100 } },
      ]),
    ).toBe(false);
    expect(
      isValidBlockNoteDoc([
        {
          type: "image",
          props: validProps,
          content: [{ type: "text", text: "invalid" }],
        },
      ]),
    ).toBe(false);
    expect(
      isValidBlockNoteDoc([
        {
          type: "image",
          props: validProps,
          children: [{ type: "paragraph", content: [] }],
        },
      ]),
    ).toBe(false);
  });

  it("preserves authored whitespace around valid image props", () => {
    const blocks: PostBlock[] = [
      {
        type: "image",
        props: {
          storageId: " storage-1 ",
          altText: " A diagram ",
          caption: " A caption ",
        },
      },
    ];

    expect(isValidBlockNoteDoc(blocks)).toBe(true);
    expect(extractImageStorageIds(blocks)).toEqual([" storage-1 "]);
  });

  it("accepts heading levels 1 through 3 only", () => {
    for (const level of [1, 2, 3]) {
      expect(
        isValidBlockNoteDoc([
          {
            type: "heading",
            props: { level },
            content: [{ type: "text", text: "heading" }],
          },
        ]),
      ).toBe(true);
    }

    for (const level of [0, 4, -1, "2", null]) {
      expect(
        isValidBlockNoteDoc([
          {
            type: "heading",
            props: { level },
            content: [{ type: "text", text: "heading" }],
          },
        ]),
      ).toBe(false);
    }
  });

  it("accepts only the approved inline styles", () => {
    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "styled",
              styles: {
                bold: true,
                italic: true,
                underline: true,
                strike: true,
                code: true,
              },
            },
          ],
        },
      ]),
    ).toBe(true);

    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "styled",
              styles: { backgroundColor: "red" },
            },
          ],
        },
      ]),
    ).toBe(false);
  });

  it("rejects invalid block properties and content shapes", () => {
    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          props: { level: 2 },
          content: [{ type: "text", text: "invalid props" }],
        },
      ]),
    ).toBe(false);
    expect(
      isValidBlockNoteDoc([{ type: "paragraph", content: "plain string" }]),
    ).toBe(false);
    expect(
      isValidBlockNoteDoc([
        { type: "codeBlock", props: { language: 42 }, content: "code" },
      ]),
    ).toBe(false);
  });

  it("rejects documents beyond structural safety limits", () => {
    expect(
      isValidBlockNoteDoc(
        Array.from({ length: MAX_BLOCKS + 1 }, () => ({
          type: "paragraph",
          content: [{ type: "text", text: "block" }],
        })),
      ),
    ).toBe(false);

    expect(
      isValidBlockNoteDoc([
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "parent" }],
          children: Array.from({ length: MAX_CHILDREN_PER_BLOCK + 1 }, () => ({
            type: "bulletListItem",
            content: [{ type: "text", text: "child" }],
          })),
        },
      ]),
    ).toBe(false);

    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          content: Array.from({ length: MAX_INLINE_NODES + 1 }, () => ({
            type: "text",
            text: "text",
          })),
        },
      ]),
    ).toBe(false);
  });

  it("rejects excessive recursive nesting", () => {
    let block: Record<string, unknown> = {
      type: "paragraph",
      content: [{ type: "text", text: "nested" }],
    };

    for (let depth = 0; depth <= MAX_RECURSION_DEPTH; depth += 1) {
      block = {
        type: "bulletListItem",
        content: [{ type: "text", text: "nested" }],
        children: [block],
      };
    }

    expect(isValidBlockNoteDoc([block])).toBe(false);
  });

  it("rejects documents whose extracted text is too large", () => {
    expect(
      isValidBlockNoteDoc([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x".repeat(MAX_POST_TEXT_LENGTH + 1),
            },
          ],
        },
      ]),
    ).toBe(false);
  });
});

describe("extractImageStorageIds", () => {
  it("ignores image blocks with malformed props or forbidden fields", () => {
    const validProps = { storageId: "malformed", altText: "An image" };

    expect(
      extractImageStorageIds([
        { type: "image", props: { storageId: "missing-alt" } },
        { type: "image", props: { ...validProps, altText: "   " } },
        { type: "image", props: { ...validProps, altText: 42 } },
        { type: "image", props: { ...validProps, width: 100 } },
        {
          type: "image",
          props: validProps,
          content: [{ type: "text", text: "not allowed" }],
        },
        {
          type: "image",
          props: validProps,
          children: [{ type: "paragraph", content: [] }],
        },
      ]),
    ).toEqual([]);
  });

  it("returns unique nested image storage IDs in document order", () => {
    expect(
      extractImageStorageIds([
        {
          type: "image",
          props: { storageId: "first", altText: "First" },
        },
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "parent" }],
          children: [
            {
              type: "image",
              props: { storageId: "second", altText: "Second" },
            },
            {
              type: "bulletListItem",
              content: [{ type: "text", text: "nested" }],
              children: [
                {
                  type: "image",
                  props: { storageId: "first", altText: "Duplicate" },
                },
              ],
            },
          ],
        },
      ]),
    ).toEqual(["first", "second"]);
  });

  it("does not traverse beyond the global block limit", () => {
    const blocks: PostBlock[] = Array.from(
      { length: MAX_BLOCKS + 1 },
      (_, index) => ({
        type: "image",
        props: { storageId: `storage-${index}`, altText: "Image" },
      }),
    );

    expect(extractImageStorageIds(blocks)).toHaveLength(MAX_BLOCKS);
    expect(extractImageStorageIds(blocks)).not.toContain(
      `storage-${MAX_BLOCKS}`,
    );
  });

  it("does not traverse oversized children arrays", () => {
    expect(
      extractImageStorageIds([
        {
          type: "bulletListItem",
          children: Array.from({ length: MAX_CHILDREN_PER_BLOCK + 1 }, () => ({
            type: "image",
            props: { storageId: "oversized", altText: "Image" },
          })),
        },
      ]),
    ).toEqual([]);
  });

  it("does not return images beyond the maximum recursion depth", () => {
    let tooDeep: PostBlock = {
      type: "image",
      props: { storageId: "too-deep", altText: "Too deep" },
    };
    for (let depth = 0; depth <= MAX_RECURSION_DEPTH; depth += 1) {
      tooDeep = {
        type: "bulletListItem",
        children: [tooDeep],
      };
    }

    let shallow: PostBlock = {
      type: "image",
      props: { storageId: "shallow", altText: "Shallow" },
    };
    for (let depth = 0; depth < MAX_RECURSION_DEPTH - 1; depth += 1) {
      shallow = {
        type: "bulletListItem",
        children: [shallow],
      };
    }

    expect(extractImageStorageIds([tooDeep])).toEqual([]);
    expect(extractImageStorageIds([shallow])).toEqual(["shallow"]);
  });
});
