import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { parsePostBody } from "@/lib/post-content";
import { PostBody } from "@/components/web/PostBody";
import {
  blockNoteSupportedLanguages,
  CODE_LANGUAGES,
} from "@/lib/code-languages";
import {
  editorSchema,
  BodyFormattingToolbar,
  getEditorPasteOptions,
  getInitialEditorContent,
  HistoryControls,
  isSafeAuthorLink,
  normalizeBlock,
  serializeEditorDocument,
  type EditorBlock,
} from "./PostBodyEditor";

vi.mock("@/components/web/HighlightedCode", () => ({
  HighlightedCode: ({ code }: { code: string }) => <pre>{code}</pre>,
}));

const jsdomRect = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  toJSON: () => ({}),
  top: 0,
  width: 0,
  x: 0,
  y: 0,
} as DOMRect;

beforeAll(() => {
  // jsdom has no layout; ProseMirror measures selections after programmatic
  // edits, which needs Range and element rects.
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [jsdomRect],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => jsdomRect,
  });
  Object.defineProperty(Element.prototype, "getClientRects", {
    configurable: true,
    value: () => [jsdomRect],
  });
  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => jsdomRect,
  });
});

function buildFullEditor() {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { type: "paragraph", content: "Intro paragraph" },
      { type: "heading", props: { level: 2 }, content: "Heading two" },
      { type: "heading", props: { level: 3 }, content: "Heading three" },
      { type: "heading", props: { level: 4 }, content: "Heading four" },
      { type: "heading", props: { level: 5 }, content: "Heading five" },
      { type: "heading", props: { level: 6 }, content: "Heading six" },
      { type: "quote", content: "Quoted line" },
      { type: "bulletListItem", content: "Bullet item" },
      { type: "numberedListItem", content: "Numbered item" },
      { type: "checkListItem", props: { checked: true }, content: "Checked" },
      { type: "toggleListItem", content: "Toggle item" },
      {
        type: "codeBlock",
        props: { language: "typescript" },
        content: "const answer = 42;",
      },
      { type: "divider" },
      {
        type: "table",
        content: {
          type: "tableContent",
          rows: [{ cells: ["Cell A", "Cell B"] }],
        },
      },
      {
        type: "image",
        props: { url: "storage-image-1", name: "lake.png", caption: "A lake" },
      },
      { type: "audio", props: { url: "storage-audio-1", name: "sound.mp3" } },
      {
        type: "video",
        props: { url: "https://cdn.example.com/clip.mp4", name: "clip.mp4" },
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Styled paragraph",
            styles: { bold: true, textColor: "red" },
          },
        ],
      },
    ],
  });
}

describe("PostBodyEditor configuration", () => {
  it("shows only H2 through H6 in the native block-type dropdown", async () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "paragraph", content: "Select a heading" }],
    });
    render(
      <BlockNoteView editor={editor} formattingToolbar={false}>
        <BodyFormattingToolbar />
      </BlockNoteView>,
    );
    fireEvent.click(screen.getByRole("combobox"));
    const items = await screen.findAllByRole("option");
    expect(
      items
        .filter((item) => /heading/i.test(item.textContent ?? ""))
        .map((item) => item.textContent),
    ).toEqual([
      "Heading 2",
      "Heading 3",
      "Heading 4",
      "Heading 5",
      "Heading 6",
    ]);
    fireEvent.keyDown(screen.getByRole("option", { name: "Heading 4" }), {
      key: "Enter",
    });
    expect(editor.document[0]).toMatchObject({
      type: "heading",
      props: { level: 4 },
    });
  });
  it("offers only body headings and creates an H2 by default", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "heading", content: "Section" }],
    });
    expect(editor.document[0].props).toMatchObject({ level: 2 });
    expect(editor.document[0].props).not.toHaveProperty("isToggleable");
    const keys = getDefaultReactSlashMenuItems(editor).map(
      (item) => (item as { key?: string }).key,
    );
    expect(keys.filter((key) => key?.includes("heading"))).toEqual([
      "heading_2",
      "heading_3",
      "heading_4",
      "heading_5",
      "heading_6",
    ]);
  });

  it("normalizes raw hydration and serialized editor heading levels", () => {
    for (const [input, output] of [
      [1, 2],
      [4, 4],
      [7, 6],
    ]) {
      const block = {
        id: "editor-only-id",
        type: "heading",
        props: { level: input },
        content: "Heading",
        children: [],
      };
      expect(normalizeBlock(block).props?.level).toBe(output);
      expect(
        getInitialEditorContent({ format: "blocknote@1", blocks: [block] })?.[0]
          .props?.level,
      ).toBe(output);
    }
  });
  it("keeps the complete standard BlockNote block and style set available", () => {
    expect(editorSchema.blockSpecs.checkListItem).toBeDefined();
    expect(editorSchema.blockSpecs.toggleListItem).toBeDefined();
    expect(editorSchema.blockSpecs.divider).toBeDefined();
    expect(editorSchema.blockSpecs.table).toBeDefined();
    expect("file" in editorSchema.blockSpecs).toBe(false);
    expect(editorSchema.blockSpecs.audio).toBeDefined();
    expect(editorSchema.blockSpecs.video).toBeDefined();
    expect(editorSchema.styleSpecs.textColor).toBeDefined();
    expect(editorSchema.styleSpecs.backgroundColor).toBeDefined();
  });

  it("leaves the installed slash menu unfiltered", () => {
    const editor = BlockNoteEditor.create({ schema: editorSchema });
    const keys = getDefaultReactSlashMenuItems(editor).map(
      (item) => (item as { key?: string }).key,
    );

    expect(keys).toContain("check_list");
    expect(keys).toContain("divider");
    expect(keys).toContain("table");
    expect(keys).toContain("image");
  });

  it("omits empty initial content so BlockNote creates its default paragraph", () => {
    expect(
      getInitialEditorContent({ format: "blocknote@1", blocks: [] }),
    ).toBeUndefined();
  });

  it("keeps the canonical language selector on the standard code block", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "codeBlock", content: "x" }],
    });
    const block = editor.document[0];
    if (block.type !== "codeBlock") throw new Error("Expected a code block");
    const container = document.createElement("div");
    editor.mount(container);

    try {
      expect(
        Array.from(container.querySelectorAll("select option")),
      ).toHaveLength(CODE_LANGUAGES.length);
      expect(Object.keys(blockNoteSupportedLanguages)).toEqual(
        CODE_LANGUAGES.map(({ id }) => id),
      );
      expect(block.props.language).toBe("text");
    } finally {
      editor.unmount();
    }
  });

  it("normalizes unknown code languages to the canonical fallback", () => {
    expect(
      normalizeBlock({
        type: "codeBlock",
        props: { language: "unknown" },
        content: [{ type: "text", text: "const answer = 42;" }],
        children: [],
      }),
    ).toEqual({
      type: "codeBlock",
      props: { language: "text" },
      content: "const answer = 42;",
    });
  });

  it("retains native media presentation props in the editor projection", () => {
    expect(
      normalizeBlock({
        type: "image",
        props: {
          url: "storage-image-1",
          caption: "Morning light",
          name: "lake.jpg",
          previewWidth: 500,
          showPreview: true,
          textAlignment: "center",
        },
        content: undefined,
        children: [],
      }),
    ).toMatchObject({
      type: "image",
      props: {
        source: { kind: "storage", id: "storage-image-1" },
        textAlignment: "center",
      },
    });
  });

  it("accepts only safe author link protocols", () => {
    expect(isSafeAuthorLink("https://example.com/article")).toBe(true);
    expect(isSafeAuthorLink("mailto:editor@example.com")).toBe(true);
    expect(isSafeAuthorLink("javascript:alert(1)")).toBe(false);
  });

  it("uses BlockNote's native Markdown paste policy while preferring HTML", () => {
    expect(getEditorPasteOptions()).toEqual({
      prioritizeMarkdownOverHTML: false,
      plainTextAsMarkdown: true,
    });
  });
});

describe("editor to persistence to reader round trip", () => {
  const expectedTypes = [
    "paragraph",
    "heading",
    "quote",
    "bulletListItem",
    "numberedListItem",
    "checkListItem",
    "toggleListItem",
    "codeBlock",
    "divider",
    "table",
    "image",
    "audio",
    "video",
  ];

  it("keeps every enabled default block through serialization, validation, and rendering", async () => {
    const editor = buildFullEditor();
    const serialized = serializeEditorDocument(
      editor.document as unknown as EditorBlock[],
    );

    const parsed = parsePostBody(JSON.stringify(serialized));
    expect(parsed.kind).toBe("structured");
    if (parsed.kind !== "structured") return;

    const types = parsed.document.blocks.map((block) => block.type);
    for (const type of expectedTypes) expect(types).toContain(type);

    expect(
      parsed.document.blocks
        .filter((block) => block.type === "heading")
        .map((block) => block.props?.level),
    ).toEqual([2, 3, 4, 5, 6]);

    const image = parsed.document.blocks.find(
      (block) => block.type === "image",
    );
    expect(image?.props?.source).toEqual({
      kind: "storage",
      id: "storage-image-1",
    });
    const video = parsed.document.blocks.find(
      (block) => block.type === "video",
    );
    expect(video?.props?.source).toEqual({
      kind: "url",
      url: "https://cdn.example.com/clip.mp4",
    });
    const table = parsed.document.blocks.find(
      (block) => block.type === "table",
    );
    expect((table?.content as { type?: string } | undefined)?.type).toBe(
      "tableContent",
    );

    const { container } = render(
      await PostBody({
        body: JSON.stringify(serialized),
        inlineImages: [
          {
            storageId: "storage-image-1",
            url: "https://cdn.example.com/lake.png",
          },
          {
            storageId: "storage-audio-1",
            url: "https://cdn.example.com/sound.mp3",
          },
        ],
      }),
    );

    expect(container.querySelector("h1")).toBeNull();
    for (const level of [2, 3, 4, 5, 6]) {
      expect(container.querySelector(`h${level}`)).not.toBeNull();
    }
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector("audio")).not.toBeNull();
    expect(container.querySelector("video")).not.toBeNull();
    expect(screen.getByText("Intro paragraph")).toBeVisible();
    expect(screen.getByText("const answer = 42;")).toBeVisible();
  });
});

describe("editor history controls", () => {
  it("tracks undo and redo availability with accessible icon buttons", async () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "paragraph", content: "One" }],
    });

    render(
      <BlockNoteView editor={editor}>
        <HistoryControls />
      </BlockNoteView>,
    );

    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();

    act(() => {
      editor.updateBlock(editor.document[0], { content: "Two" });
    });

    await waitFor(() => expect(undo).toBeEnabled());
    fireEvent.click(undo);
    await waitFor(() => expect(redo).toBeEnabled());
    expect(editor.document[0].content).toEqual([
      { type: "text", text: "One", styles: {} },
    ]);

    fireEvent.click(redo);
    await waitFor(() =>
      expect(editor.document[0].content).toEqual([
        { type: "text", text: "Two", styles: {} },
      ]),
    );
  });
});
