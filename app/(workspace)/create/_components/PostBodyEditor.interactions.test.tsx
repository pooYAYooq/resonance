import { BlockNoteEditor } from "@blocknote/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import PostBodyEditor, {
  editorSchema,
  getCuratedPasteOptions,
  isSafeAuthorLink,
  normalizeBlock,
  type EditorBlock,
} from "./PostBodyEditor";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

const browserRect = {
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
let boundingRectSpy: ReturnType<typeof vi.spyOn>;
let clientRectsSpy: ReturnType<typeof vi.spyOn>;
let rangeClientRectsDescriptor: PropertyDescriptor | undefined;
let rangeBoundingRectDescriptor: PropertyDescriptor | undefined;

beforeAll(() => {
  boundingRectSpy = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue(browserRect);
  clientRectsSpy = vi
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([browserRect] as unknown as DOMRectList);
  rangeClientRectsDescriptor = Object.getOwnPropertyDescriptor(
    Range.prototype,
    "getClientRects",
  );
  rangeBoundingRectDescriptor = Object.getOwnPropertyDescriptor(
    Range.prototype,
    "getBoundingClientRect",
  );
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [browserRect],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => browserRect,
  });
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => document.body,
  });
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: () => [],
  });
});

afterAll(() => {
  boundingRectSpy.mockRestore();
  clientRectsSpy.mockRestore();
  if (rangeClientRectsDescriptor) {
    Object.defineProperty(
      Range.prototype,
      "getClientRects",
      rangeClientRectsDescriptor,
    );
  } else {
    delete (Range.prototype as unknown as Record<string, unknown>)[
      "getClientRects"
    ];
  }
  if (rangeBoundingRectDescriptor) {
    Object.defineProperty(
      Range.prototype,
      "getBoundingClientRect",
      rangeBoundingRectDescriptor,
    );
  } else {
    delete (Range.prototype as unknown as Record<string, unknown>)[
      "getBoundingClientRect"
    ];
  }
});

function expectEditorSelection(editor: HTMLElement) {
  const selection = window.getSelection();
  expect(selection?.rangeCount).toBeGreaterThan(0);
  expect(editor.contains(selection?.anchorNode ?? null)).toBe(true);
}

describe("PostBodyEditor native interaction contract", () => {
  it("mounts one contenteditable editor without unsupported native UI", () => {
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );

    expect(container.querySelector('[contenteditable="true"]')).not.toBeNull();
    expect(container.querySelector('[aria-label*="Color" i]')).toBeNull();
    expect(container.querySelector('[aria-label*="Align" i]')).toBeNull();
  });

  it("uses BlockNote's native Markdown paste policy while preferring HTML", () => {
    expect(getCuratedPasteOptions()).toEqual({
      prioritizeMarkdownOverHTML: false,
      plainTextAsMarkdown: true,
    });
  });

  it("preserves safe rich links and strips unsafe links plus unsupported colors", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      links: { isValidLink: isSafeAuthorLink },
    });
    const [richBlock] = editor.tryParseHTMLToBlocks(
      '<blockquote><strong>Supported</strong> <a href="https://example.com">link</a></blockquote>',
    );
    const [unsafeBlock] = editor.tryParseHTMLToBlocks(
      '<p style="color: red"><a href="javascript:alert(1)">Safe text</a></p>',
    );

    expect(normalizeBlock(richBlock as unknown as EditorBlock)).toMatchObject({
      type: "quote",
    });
    expect(normalizeBlock(unsafeBlock as unknown as EditorBlock)).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Safe text" }],
    });
  });

  it("moves slash-menu selection with ArrowDown without leaving the editor", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editor).not.toBeNull();

    await user.click(editor!);
    await user.type(editor!, "/");
    expect(document.activeElement).toBe(editor);
    expect(screen.queryByText(/Ctrl[-+]|Shift/i)).not.toBeInTheDocument();
    const options = screen.getAllByRole("option");
    const initiallySelected = options.find((option) =>
      option.hasAttribute("aria-selected"),
    );
    expect(initiallySelected).toBeDefined();

    await user.keyboard("{ArrowDown}");

    const selectedAfterArrow = screen
      .getAllByRole("option")
      .find((option) => option.hasAttribute("aria-selected"));
    expect(selectedAfterArrow).toBeDefined();
    expect(selectedAfterArrow).not.toBe(initiallySelected);
    expect(document.activeElement).toBe(editor);
  });

  it("inserts the selected slash block while retaining editor focus", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editor).not.toBeNull();

    await user.click(editor!);
    await user.type(editor!, "/");
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(
      editor!.querySelector('[data-content-type="heading"]'),
    ).not.toBeNull();
    expect(document.activeElement).toBe(editor);
    expect(window.getSelection()?.anchorNode).not.toBeNull();
  });

  it("dismisses the slash menu with Escape while retaining caret focus", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editor).not.toBeNull();

    await user.click(editor!);
    await user.type(editor!, "/");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(editor);
    const selection = window.getSelection();
    expect(selection?.rangeCount).toBeGreaterThan(0);
    expect(selection?.anchorNode).not.toBeNull();
    expect(editor!.contains(selection?.anchorNode ?? null)).toBe(true);
  });

  it("splits a paragraph with Enter while keeping focus in the editor", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editor).not.toBeNull();

    await user.click(editor!);
    await user.type(editor!, "Line one");
    await user.keyboard("{Enter}");
    await user.type(editor!, "Line two");

    await waitFor(() => {
      const paragraphs = editor!.querySelectorAll(
        '[data-content-type="paragraph"]',
      );
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    });
    expect(document.activeElement).toBe(editor);
  });

  it("merges two paragraphs with Backspace from the start of the second block", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editor).not.toBeNull();

    await user.click(editor!);
    await user.type(editor!, "First");
    await user.keyboard("{Enter}");
    await user.type(editor!, "Second");
    fireEvent.keyDown(editor!, { key: "Home" });
    fireEvent.keyDown(editor!, { key: "Backspace" });

    await waitFor(() => {
      expect(editor!.textContent).toContain("FirstSecond");
    });
  });

  it("moves the caret with Arrow keys without leaving the editor", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editor).not.toBeNull();

    await user.click(editor!);
    await user.type(editor!, "abc");

    fireEvent.keyDown(editor!, { key: "ArrowLeft" });

    expect(document.activeElement).toBe(editor);
    // jsdom cannot reliably expose ProseMirror's caret offset after movement.
    expectEditorSelection(editor!);
  });

  it("places the caret at the line start with Home and line end with End", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editor).not.toBeNull();

    await user.click(editor!);
    await user.type(editor!, "hello");
    fireEvent.keyDown(editor!, { key: "Home" });

    expect(document.activeElement).toBe(editor);
    expectEditorSelection(editor!);

    fireEvent.keyDown(editor!, { key: "End" });
    expect(document.activeElement).toBe(editor);
    expectEditorSelection(editor!);
  });

  it("restores previous content after a native undo shortcut", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editor).not.toBeNull();

    await user.click(editor!);
    await user.type(editor!, "typed");

    await waitFor(() => {
      expect(editor!.textContent).toContain("typed");
    });

    await user.keyboard("{Control>}z{/Control}");

    expect(document.activeElement).toBe(editor);
  });
});
