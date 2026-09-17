import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";
import {
  CODE_LANGUAGES,
  blockNoteSupportedLanguages,
} from "@/lib/code-languages";
import {
  editorSchema,
  getCuratedBlockTypeSelectItems,
  getCuratedPasteOptions,
  getCuratedSlashMenuItems,
  getInitialEditorContent,
  getTurnIntoBlockUpdate,
  isSafeAuthorLink,
  normalizeBlock,
} from "./PostBodyEditor";
import type { EditorBlock } from "./PostBodyEditor";

describe("PostBodyEditor configuration", () => {
  it("omits empty initial content so BlockNote can create its default paragraph", () => {
    expect(
      getInitialEditorContent({ format: "blocknote@1", blocks: [] }),
    ).toBeUndefined();
  });

  it("keeps only the approved slash menu items", () => {
    const items = [
      { key: "heading", title: "Heading 1" },
      { key: "heading_2", title: "Heading 2", badge: "Ctrl-Alt-2" },
      { key: "heading_3", title: "Heading 3", badge: "Ctrl-Alt-3" },
      { key: "heading_4", title: "Heading 4", badge: "Ctrl-Alt-4" },
      { key: "heading_5", title: "Heading 5", badge: "Ctrl-Alt-5" },
      { key: "heading_6", title: "Heading 6", badge: "Ctrl-Alt-6" },
      { key: "toggle_heading", title: "Toggle Heading 1" },
      { key: "emoji", title: "Emoji" },
      { key: "paragraph", title: "Paragraph" },
      { key: "code_block", title: "Code Block" },
      { key: "image", title: "Image" },
    ];

    expect(getCuratedSlashMenuItems(items)).toEqual([
      { key: "heading_2", title: "Section heading" },
      { key: "heading_3", title: "Subheading" },
      { key: "heading_4", title: "Heading 4" },
      { key: "heading_5", title: "Heading 5" },
      { key: "heading_6", title: "Heading 6" },
      { key: "paragraph", title: "Paragraph" },
      { key: "code_block", title: "Code Block" },
      { key: "image", title: "Image" },
    ]);
  });

  it("exposes heading levels 4 through 6 from BlockNote's default slash menu", () => {
    const editor = BlockNoteEditor.create({ schema: editorSchema });
    const items = getDefaultReactSlashMenuItems(editor);
    const headings = getCuratedSlashMenuItems(items).filter((item) =>
      String((item as { key?: unknown }).key).startsWith("heading_"),
    );

    expect(
      headings.map((item) => (item as unknown as { key: string }).key),
    ).toEqual([
      "heading_2",
      "heading_3",
      "heading_4",
      "heading_5",
      "heading_6",
    ]);
  });

  it("keeps only paragraph, section, and list block types in the toolbar", () => {
    const items = [
      { name: "Paragraph", type: "paragraph" },
      { name: "Heading 1", type: "heading", props: { level: 1 } },
      {
        name: "Heading 2",
        type: "heading",
        props: { level: 2, isToggleable: false },
      },
      {
        name: "Heading 3",
        type: "heading",
        props: { level: 3, isToggleable: false },
      },
      {
        name: "Heading 4",
        type: "heading",
        props: { level: 4, isToggleable: false },
      },
      {
        name: "Heading 5",
        type: "heading",
        props: { level: 5, isToggleable: false },
      },
      {
        name: "Heading 6",
        type: "heading",
        props: { level: 6, isToggleable: false },
      },
      {
        name: "Toggle Heading 2",
        type: "heading",
        props: { level: 2, isToggleable: true },
      },
      { name: "Quote", type: "quote" },
      { name: "Bullet List", type: "bulletListItem" },
      { name: "Numbered List", type: "numberedListItem" },
      { name: "Code block", type: "codeBlock" },
      { name: "Image", type: "image" },
      { name: "Check List", type: "checkListItem" },
    ];

    expect(getCuratedBlockTypeSelectItems(items)).toEqual([
      { name: "Paragraph", type: "paragraph" },
      { name: "Section heading", type: "heading", props: { level: 2 } },
      { name: "Subheading", type: "heading", props: { level: 3 } },
      { name: "Heading 4", type: "heading", props: { level: 4 } },
      { name: "Heading 5", type: "heading", props: { level: 5 } },
      { name: "Heading 6", type: "heading", props: { level: 6 } },
      { name: "Quote", type: "quote" },
      { name: "Bullet List", type: "bulletListItem" },
      { name: "Numbered List", type: "numberedListItem" },
      { name: "Image", type: "image" },
    ]);
  });

  it("serializes BlockNote code content from its inline-node shape", () => {
    expect(
      normalizeBlock({
        type: "codeBlock",
        props: { language: "ts" },
        content: [{ type: "text", text: "const answer = 42;", styles: {} }],
        children: [],
      }),
    ).toEqual({
      type: "codeBlock",
      props: { language: "typescript" },
      content: "const answer = 42;",
    });
  });

  it("offers only canonical languages in the native code-block selector", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "codeBlock", content: "x" }],
    });
    const block = editor.document[0];
    if (block.type !== "codeBlock") throw new Error("Expected a code block");
    const container = document.createElement("div");
    editor.mount(container);

    try {
      const select = container.querySelector("select");
      expect(select).not.toBeNull();
      expect(Array.from(select?.options ?? [], ({ value }) => value)).toEqual(
        CODE_LANGUAGES.map(({ id }) => id),
      );
      expect(Object.keys(blockNoteSupportedLanguages)).toEqual(
        CODE_LANGUAGES.map(({ id }) => id),
      );
      expect(select?.value).toBe("text");
      expect(block.props.language).toBe("text");
    } finally {
      editor.unmount();
    }
  });

  it.each([
    ["kotlin", "text"],
    ["", "text"],
    [undefined, "text"],
    [42, "text"],
    ["rs", "rust"],
    ["rust", "rust"],
  ])("serializes code language %s as %s", (language, expected) => {
    expect(
      normalizeBlock({
        type: "codeBlock",
        props: { language },
        content: "x",
        children: [],
      }),
    ).toEqual({
      type: "codeBlock",
      props: { language: expected },
      content: "x",
    });
  });

  it.each([
    [1, 2],
    [2, 2],
    [4, 4],
    [6, 6],
    [7, 6],
    ["4", 2],
    [undefined, 2],
  ])("normalizes heading level %s to %s", (level, expected) => {
    expect(
      normalizeBlock({
        type: "heading",
        props: { level },
        content: [{ type: "text", text: "heading" }],
        children: [],
      }),
    ).toEqual({
      type: "heading",
      props: { level: expected },
      content: [{ type: "text", text: "heading" }],
    });
  });

  it("normalizes heading levels inside nested children", () => {
    expect(
      normalizeBlock({
        type: "bulletListItem",
        props: {},
        content: [{ type: "text", text: "item" }],
        children: [
          {
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "nested one" }],
            children: [],
          },
          {
            type: "heading",
            props: { level: 7 },
            content: [{ type: "text", text: "nested seven" }],
            children: [],
          },
        ],
      }),
    ).toMatchObject({
      children: [
        { type: "heading", props: { level: 2 } },
        { type: "heading", props: { level: 6 } },
      ],
    });
  });

  it("includes the curated image block and strips transient image props", () => {
    expect(editorSchema.blockSpecs.image).toBeDefined();
    expect(
      normalizeBlock({
        type: "image",
        props: {
          url: "storage-image-1",
          name: "A mountain lake",
          altText: "A mountain lake",
          caption: "Morning light",
          textAlignment: "center",
          previewWidth: 500,
          showPreview: true,
        },
        content: [],
        children: [],
      }),
    ).toEqual({
      type: "image",
      props: {
        storageId: "storage-image-1",
        altText: "A mountain lake",
        caption: "Morning light",
      },
    });
  });

  it("serializes dedicated alt text without using the file name", () => {
    expect(
      normalizeBlock({
        type: "image",
        props: {
          url: "storage-image-1",
          name: "mountain-lake.jpg",
          altText: "A mountain lake at sunrise",
        },
        content: [],
        children: [],
      }),
    ).toEqual({
      type: "image",
      props: {
        storageId: "storage-image-1",
        altText: "A mountain lake at sunrise",
      },
    });
  });

  it("uses an empty alt text when an image has no alt text", () => {
    expect(
      normalizeBlock({
        type: "image",
        props: { url: "storage-image-2", name: "mountain-lake.jpg" },
        content: [],
        children: [],
      }),
    ).toEqual({
      type: "image",
      props: { storageId: "storage-image-2", altText: "" },
    });
  });

  it("exposes only non-toggleable headings from H2 through H6", () => {
    const propSchema = editorSchema.blockSpecs.heading.config.propSchema;

    expect(propSchema.level.values).toEqual([2, 3, 4, 5, 6]);
    expect(propSchema.level.default).toBe(2);
    expect("isToggleable" in propSchema).toBe(false);
  });

  it("accepts only author-safe link protocols at every BlockNote entry point", () => {
    expect(isSafeAuthorLink("https://example.com/article")).toBe(true);
    expect(isSafeAuthorLink("http://localhost:3000/preview")).toBe(true);
    expect(isSafeAuthorLink("mailto:editor@example.com")).toBe(true);
    expect(isSafeAuthorLink("javascript:alert(1)")).toBe(false);
    expect(isSafeAuthorLink("data:text/html,unsafe")).toBe(false);
    expect(isSafeAuthorLink("ftp://example.com/file")).toBe(false);
  });

  it("preserves link text when an unsafe link is rejected", () => {
    expect(
      normalizeBlock({
        type: "paragraph",
        props: {},
        content: [
          {
            type: "link",
            href: "javascript:alert(1)",
            content: [{ type: "text", text: "Keep this text", styles: {} }],
          },
        ],
        children: [],
      }),
    ).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Keep this text" }],
    });
  });

  it("uses deterministic rich-text paste preferences within the curated schema", () => {
    expect(getCuratedPasteOptions()).toEqual({
      prioritizeMarkdownOverHTML: false,
      plainTextAsMarkdown: true,
    });
  });

  it("drops unsupported rich-text formatting and unsafe links from pasted HTML", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      links: { isValidLink: isSafeAuthorLink },
    });
    const [block] = editor.tryParseHTMLToBlocks(
      '<p style="color: red"><a href="javascript:alert(1)">Keep this text</a></p>',
    );

    expect(normalizeBlock(block as unknown as EditorBlock)).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Keep this text" }],
    });
  });

  it("turns blocks into only the approved semantic types", () => {
    expect(getTurnIntoBlockUpdate("heading-2")).toEqual({
      type: "heading",
      props: { level: 2 },
    });
    expect(getTurnIntoBlockUpdate("heading-3")).toEqual({
      type: "heading",
      props: { level: 3 },
    });
    expect(getTurnIntoBlockUpdate("heading-4")).toEqual({
      type: "heading",
      props: { level: 4 },
    });
    expect(getTurnIntoBlockUpdate("heading-5")).toEqual({
      type: "heading",
      props: { level: 5 },
    });
    expect(getTurnIntoBlockUpdate("heading-6")).toEqual({
      type: "heading",
      props: { level: 6 },
    });
    expect(getTurnIntoBlockUpdate("quote")).toEqual({ type: "quote" });
    expect(getTurnIntoBlockUpdate("code")).toBeUndefined();
    expect(getTurnIntoBlockUpdate("checklist")).toBeUndefined();
  });
});
