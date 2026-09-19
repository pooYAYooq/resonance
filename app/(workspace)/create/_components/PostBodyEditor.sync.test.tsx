import { render } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import PostBodyEditor, { type PostBodyEditorHandle } from "./PostBodyEditor";

const { editor, replaceBlocks, setDocument, viewProps } = vi.hoisted(() => {
  let document: unknown[] = [];
  const replaceBlocks = vi.fn(
    (_existing: unknown[], next: unknown[]) => (document = [...next]),
  );
  const viewProps: { current: Record<string, unknown> | undefined } = {
    current: undefined,
  };

  return {
    editor: {
      get document() {
        return document;
      },
      focus: vi.fn(),
      replaceBlocks,
      getExtension: () => undefined,
      canExec: () => false,
      undo: vi.fn(),
      redo: vi.fn(),
      onChange: () => () => {},
    },
    replaceBlocks,
    setDocument: (next: unknown[]) => (document = [...next]),
    viewProps,
  };
});

vi.mock("@blocknote/react", () => ({
  useCreateBlockNote: () => editor,
  useBlockNoteEditor: () => editor,
  FormattingToolbarController: () => null,
  SideMenuController: () => null,
}));

vi.mock("./AuthoringSideMenu", () => ({
  AuthoringSideMenu: () => null,
}));

vi.mock("@blocknote/shadcn", () => ({
  BlockNoteView: ({ children, ...props }: { children?: ReactNode }) => {
    viewProps.current = props;
    return children;
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@/lib/use-inline-image-upload", () => ({
  useBlockNoteFileUpload: () => ({
    resolveFileUrl: vi.fn(),
    uploadFile: vi.fn(),
  }),
}));

describe("PostBodyEditor hydration", () => {
  it("keeps native BlockNote controllers enabled", () => {
    render(<PostBodyEditor onChange={() => {}} onBlur={() => {}} />);

    // A native controller is supplied explicitly to configure body headings.
    expect(viewProps.current).toHaveProperty("formattingToolbar", false);
    expect(viewProps.current).not.toHaveProperty("slashMenu", false);
    expect(viewProps.current).not.toHaveProperty("linkToolbar", false);
    // The native side menu is replaced by a drag-safe Resonance adapter.
    expect(viewProps.current).toHaveProperty("sideMenu", false);
  });

  it("clears existing blocks when initial content becomes empty", () => {
    const populated = {
      format: "blocknote@1" as const,
      blocks: [{ type: "paragraph", content: "Existing content" }],
    };
    const empty = { format: "blocknote@1" as const, blocks: [] };
    const { rerender } = render(
      <PostBodyEditor
        initialContent={populated}
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );
    setDocument(populated.blocks);
    replaceBlocks.mockClear();

    rerender(
      <PostBodyEditor
        initialContent={empty}
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );

    expect(replaceBlocks).toHaveBeenCalledWith(populated.blocks, []);
  });

  it("does not replace a dirty local document with reactive server content", () => {
    const local = {
      format: "blocknote@1" as const,
      blocks: [{ type: "paragraph", content: "Local content" }],
    };
    const refreshed = {
      format: "blocknote@1" as const,
      blocks: [{ type: "paragraph", content: "Server refresh" }],
    };
    const { rerender } = render(
      <PostBodyEditor
        initialContent={local}
        isDirty
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );
    setDocument(local.blocks);
    replaceBlocks.mockClear();

    rerender(
      <PostBodyEditor
        initialContent={refreshed}
        isDirty
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );

    expect(replaceBlocks).not.toHaveBeenCalled();
    expect(editor.document).toEqual(local.blocks);
  });

  it("exposes a narrow focus handle for write-flow validation", () => {
    const ref = createRef<PostBodyEditorHandle>();
    render(<PostBodyEditor ref={ref} onChange={() => {}} onBlur={() => {}} />);

    ref.current?.focus();
    expect(editor.focus).toHaveBeenCalled();
  });
});
