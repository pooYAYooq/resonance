import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import PostBodyEditor from "./PostBodyEditor";
import { parsePostBody } from "@/lib/post-content";
import { draftPostSchema } from "@/schemas/blog";

const { themeState } = vi.hoisted(() => ({
  themeState: { resolvedTheme: "light" as "light" | "dark" },
}));

vi.mock("next-themes", () => ({
  useTheme: () => themeState,
}));

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
let clipboardEventDescriptor: PropertyDescriptor | undefined;

class TestClipboardEvent extends Event {
  constructor(type: string, init?: EventInit) {
    super(type, init);
  }
}

beforeAll(() => {
  // jsdom has no layout measurements for text ranges used during native paste.
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => browserRect,
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [browserRect],
  });
  boundingRectSpy = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue(browserRect);
  clientRectsSpy = vi
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([browserRect] as unknown as DOMRectList);
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => document.body,
  });
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: () => [],
  });
  clipboardEventDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "ClipboardEvent",
  );
  Object.defineProperty(globalThis, "ClipboardEvent", {
    configurable: true,
    value: TestClipboardEvent,
  });
});

beforeEach(() => {
  themeState.resolvedTheme = "light";
});

afterAll(() => {
  delete (Range.prototype as unknown as Record<string, unknown>)
    .getBoundingClientRect;
  delete (Range.prototype as unknown as Record<string, unknown>).getClientRects;
  boundingRectSpy.mockRestore();
  clientRectsSpy.mockRestore();
  if (clipboardEventDescriptor) {
    Object.defineProperty(
      globalThis,
      "ClipboardEvent",
      clipboardEventDescriptor,
    );
  } else {
    delete (globalThis as Record<string, unknown>).ClipboardEvent;
  }
});

function getEditor(container: HTMLElement) {
  const editor = container.querySelector<HTMLElement>(
    '[contenteditable="true"]',
  );
  if (!editor) throw new Error("Expected BlockNote contenteditable");
  return editor;
}

describe("PostBodyEditor standard BlockNote integration", () => {
  it("loads an existing post without making its content undoable", async () => {
    const onChange = vi.fn();
    const view = render(
      <PostBodyEditor onChange={onChange} onBlur={() => {}} />,
    );
    const saved = {
      format: "blocknote@1" as const,
      blocks: [{ type: "paragraph", content: "Saved article" }],
    };
    view.rerender(
      <PostBodyEditor
        initialContent={saved}
        onChange={onChange}
        onBlur={() => {}}
      />,
    );
    await waitFor(() =>
      expect(getEditor(view.container)).toHaveTextContent("Saved article"),
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    fireEvent.keyDown(getEditor(view.container), {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
    });
    expect(getEditor(view.container)).toHaveTextContent("Saved article");
  });
  it.each(["text/plain", "text/html"])(
    "normalizes %s heading paste in the editor and emitted document with one undo",
    async (mimeType) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = render(
        <PostBodyEditor onChange={onChange} onBlur={() => {}} />,
      );
      const editor = getEditor(container);
      await user.click(editor);
      fireEvent.paste(editor, {
        clipboardData: {
          types: [mimeType],
          files: [],
          getData: (type: string) =>
            type !== mimeType
              ? ""
              : mimeType === "text/html"
                ? "<h1>Title heading</h1><h4>Deep heading</h4><p>####### stays text</p>"
                : "# Title heading\n\n#### Deep heading\n\n####### stays text",
        },
      });
      await waitFor(() =>
        expect(editor.querySelector("h2")).toHaveTextContent("Title heading"),
      );
      expect(editor.querySelector("h1")).toBeNull();
      expect(editor.querySelector("h4")).toHaveTextContent("Deep heading");
      expect(editor).toHaveTextContent("####### stays text");
      const emitted = onChange.mock.lastCall?.[0];
      expect(
        emitted.blocks
          .filter((block: { type: string }) => block.type === "heading")
          .map((block: { props: { level: number } }) => block.props.level),
      ).toEqual([2, 4]);
      expect(parsePostBody(JSON.stringify(emitted)).kind).toBe("structured");
      expect(
        draftPostSchema.safeParse({
          title: "Title",
          content: emitted,
          tags: [],
        }).success,
      ).toBe(true);
      fireEvent.keyDown(editor, { key: "z", code: "KeyZ", ctrlKey: true });
      await waitFor(() =>
        expect(editor).not.toHaveTextContent("Title heading"),
      );
      expect(editor).not.toHaveTextContent("Deep heading");
      expect(document.activeElement).toBe(editor);
      fireEvent.keyDown(editor, {
        key: "z",
        code: "KeyZ",
        ctrlKey: true,
        shiftKey: true,
      });
      await waitFor(() =>
        expect(editor.querySelector("h2")).toHaveTextContent("Title heading"),
      );
      expect(editor.querySelector("h1")).toBeNull();
      expect(editor.querySelector("h4")).toHaveTextContent("Deep heading");
    },
  );

  it("keeps H1 typing and shortcut disabled while allowing native body heading shortcuts", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = getEditor(container);
    await user.click(editor);
    await user.type(editor, "# ");
    expect(editor.querySelector("h1")).toBeNull();
    expect(editor.querySelector("p")).toHaveTextContent("#");
    fireEvent.keyDown(editor, {
      key: "1",
      code: "Digit1",
      ctrlKey: true,
      altKey: true,
    });
    expect(editor.querySelector("h1")).toBeNull();
    for (const level of [2, 3, 4, 5, 6]) {
      fireEvent.keyDown(editor, {
        key: String(level),
        code: `Digit${level}`,
        ctrlKey: true,
        altKey: true,
      });
      expect(editor.querySelector(`h${level}`)).not.toBeNull();
    }
  });
  it("mounts the standard editor without curated replacement controls", () => {
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );

    expect(getEditor(container)).toBeVisible();
    expect(screen.queryByRole("toolbar", { name: "Block actions" })).toBeNull();
  });

  it("uses the resolved application theme", () => {
    themeState.resolvedTheme = "dark";
    const { container, rerender } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editorRoot = container.querySelector<HTMLElement>(".bn-root");

    expect(editorRoot).toHaveAttribute("data-color-scheme", "dark");
    expect(editorRoot).toHaveStyle({ colorScheme: "dark" });

    themeState.resolvedTheme = "light";
    rerender(<PostBodyEditor onChange={() => {}} onBlur={() => {}} />);
    expect(editorRoot).toHaveAttribute("data-color-scheme", "light");
  });

  it("opens the native slash menu with the full standard block list", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = getEditor(container);

    await user.click(editor);
    await user.type(editor, "/");

    expect(await screen.findByRole("listbox")).toBeVisible();
    expect(screen.getByText("Check List")).toBeVisible();
    expect(screen.getByText("Table")).toBeVisible();
    expect(screen.getByText("Divider")).toBeVisible();
    expect(screen.queryByText("Heading 1")).toBeNull();
    expect(screen.queryByText(/Toggle Heading/)).toBeNull();
    for (const level of [2, 3, 4, 5, 6])
      expect(screen.getByText(`Heading ${level}`)).toBeVisible();
  });

  it("keeps editor focus while navigating and dismissing the native slash menu", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = getEditor(container);

    await user.click(editor);
    await user.type(editor, "/");
    const initiallySelected = screen
      .getAllByRole("option")
      .find((option) => option.getAttribute("aria-selected") === "true");

    await user.keyboard("{ArrowDown}");

    const selectedAfterArrow = screen
      .getAllByRole("option")
      .find((option) => option.getAttribute("aria-selected") === "true");
    expect(selectedAfterArrow).toBeDefined();
    expect(selectedAfterArrow).not.toBe(initiallySelected);
    expect(document.activeElement).toBe(editor);

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(document.activeElement).toBe(editor);
  });

  it("routes rich HTML paste through the native editor without losing focus", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PostBodyEditor onChange={() => {}} onBlur={() => {}} />,
    );
    const editor = getEditor(container);

    await user.click(editor);
    expect(() =>
      fireEvent.paste(editor, {
        clipboardData: {
          types: ["text/html", "text/plain"],
          getData: (type: string) =>
            type === "text/html" ? "<p><strong>Pasted</strong></p>" : "Pasted",
        },
      }),
    ).not.toThrow();
    expect(document.activeElement).toBe(editor);
  });
});
