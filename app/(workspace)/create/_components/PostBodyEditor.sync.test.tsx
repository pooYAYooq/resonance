import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import PostBodyEditor, { type PostBodyEditorHandle } from "./PostBodyEditor";

const {
  editor,
  insertBlocks,
  insertedDuplicate,
  moveBlocksDown,
  moveBlocksUp,
  removeBlocks,
  redo,
  replaceBlocks,
  setDocument,
  setSelectedBlocks,
  getSelectedBlocks,
  blockNoteViewProps,
  updateBlock,
  undo,
} = vi.hoisted(() => {
  let document: unknown[] = [];
  let selectedBlocks: unknown[] = [];
  const replaceBlocks = vi.fn(
    (_blocksToRemove: unknown[], blocksToInsert: unknown[]) => {
      document = [...blocksToInsert];
    },
  );
  const setDocument = (blocks: unknown[]) => {
    document = [...blocks];
  };
  const setSelectedBlocks = (blocks: unknown[]) => {
    selectedBlocks = [...blocks];
  };
  const insertedDuplicate = {
    id: "paragraph-2",
    type: "paragraph",
    props: {},
    content: "Draft paragraph",
    children: [],
  };
  const insertBlocks = vi.fn(() => [insertedDuplicate]);
  const moveBlocksDown = vi.fn();
  const moveBlocksUp = vi.fn();
  const removeBlocks = vi.fn();
  const redo = vi.fn();
  const undo = vi.fn();
  const redoCommand = {};
  const undoCommand = {};
  const updateBlock = vi.fn();
  const blockNoteViewProps: { current: Record<string, unknown> | undefined } = {
    current: undefined,
  };

  return {
    editor: {
      get document() {
        return document;
      },
      focus: vi.fn(),
      createLink: vi.fn(),
      deleteLink: vi.fn(),
      dictionary: {},
      editLink: vi.fn(),
      onChange: () => () => {},
      prosemirrorState: { selection: { from: 1, to: 2 } },
      getSelectedText: vi.fn(() => "Selected text"),
      _tiptapEditor: {
        can: () => ({ redo: false, undo: true }),
        commands: { setTextSelection: vi.fn() },
      },
      canExec: vi.fn((command) => command !== redoCommand),
      getExtension: vi.fn(() => ({ redoCommand, undoCommand })),
      getNextBlock: vi.fn(),
      getPrevBlock: vi.fn(),
      insertBlocks,
      moveBlocksDown,
      moveBlocksUp,
      removeBlocks,
      replaceBlocks,
      redo,
      setTextCursorPosition: vi.fn(),
      undo,
      updateBlock,
    },
    insertBlocks,
    insertedDuplicate,
    moveBlocksDown,
    moveBlocksUp,
    removeBlocks,
    replaceBlocks,
    setDocument,
    setSelectedBlocks,
    updateBlock,
    redo,
    undo,
    getSelectedBlocks: () => selectedBlocks,
    blockNoteViewProps,
  };
});

vi.mock("@blocknote/react", () => ({
  blockTypeSelectItems: () => [],
  BasicTextStyleButton: ({ basicTextStyle }: { basicTextStyle: string }) => (
    <button type="button">{basicTextStyle}</button>
  ),
  BlockTypeSelect: () => <button type="button">Block type</button>,
  FormattingToolbar: ({ children }: { children: ReactNode }) => <>{children}</>,
  FormattingToolbarController: ({
    formattingToolbar: Toolbar,
  }: {
    formattingToolbar: () => ReactNode;
  }) => <Toolbar />,
  getDefaultReactSlashMenuItems: () => [],
  LinkToolbarController: ({
    linkToolbar: Toolbar,
  }: {
    linkToolbar: (props: {
      url: string;
      text: string;
      range: { from: number; to: number };
      setToolbarOpen: () => void;
      setToolbarPositionFrozen: () => void;
    }) => ReactNode;
  }) => (
    <Toolbar
      url="https://example.com"
      text="Selected text"
      range={{ from: 1, to: 2 }}
      setToolbarOpen={() => {}}
      setToolbarPositionFrozen={() => {}}
    />
  ),
  SideMenuController: () => null,
  SuggestionMenuController: () => null,
  useComponentsContext: () => ({
    FormattingToolbar: {
      Button: ({
        icon,
        label,
        onClick,
      }: {
        icon: ReactNode;
        label: string;
        onClick: () => void;
      }) => (
        <button type="button" aria-label={label} onClick={onClick}>
          {icon}
        </button>
      ),
    },
    Generic: {
      Popover: {
        Content: ({ children }: { children: ReactNode }) => <>{children}</>,
        Root: ({ children }: { children: ReactNode }) => <>{children}</>,
        Trigger: ({ children }: { children: ReactNode }) => <>{children}</>,
      },
    },
  }),
  useBlockNoteEditor: () => editor,
  useCreateBlockNote: () => editor,
  useExtension: () => ({ showSelection: vi.fn() }),
  useSelectedBlocks: () => getSelectedBlocks(),
}));

vi.mock("@blocknote/shadcn", () => ({
  BlockNoteView: ({ children, ...props }: { children: ReactNode }) => {
    blockNoteViewProps.current = props;
    return children;
  },
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

describe("PostBodyEditor", () => {
  it("installs Escape capture handling for slash-menu focus recovery", () => {
    render(<PostBodyEditor onChange={() => {}} onBlur={() => {}} />);

    expect(blockNoteViewProps.current).toHaveProperty("onKeyDownCapture");
  });

  it("clears existing blocks when initial content becomes empty", () => {
    const populatedContent = {
      format: "blocknote@1" as const,
      blocks: [{ type: "paragraph", content: "Existing content" }],
    };
    const emptyContent = { format: "blocknote@1" as const, blocks: [] };

    const { rerender } = render(
      <PostBodyEditor
        initialContent={populatedContent}
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );
    setDocument(populatedContent.blocks);
    replaceBlocks.mockClear();

    rerender(
      <PostBodyEditor
        initialContent={emptyContent}
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );

    expect(replaceBlocks).toHaveBeenCalledWith(populatedContent.blocks, []);
    expect(editor.document).toEqual([]);
  });

  it("does not replace a dirty local document with reactive server content", () => {
    const localContent = {
      format: "blocknote@1" as const,
      blocks: [{ type: "paragraph", content: "Local content" }],
    };
    const refreshedServerContent = {
      format: "blocknote@1" as const,
      blocks: [{ type: "paragraph", content: "Server refresh" }],
    };

    const { rerender } = render(
      <PostBodyEditor
        initialContent={localContent}
        isDirty
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );
    setDocument(localContent.blocks);
    replaceBlocks.mockClear();

    rerender(
      <PostBodyEditor
        initialContent={refreshedServerContent}
        isDirty
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );

    expect(replaceBlocks).not.toHaveBeenCalled();
    expect(editor.document).toEqual(localContent.blocks);
  });

  it("does not rehydrate the same payload when dirty state clears", () => {
    const savedContent = {
      format: "blocknote@1" as const,
      blocks: [{ type: "paragraph", content: "Saved content" }],
    };

    const { rerender } = render(
      <PostBodyEditor
        initialContent={savedContent}
        isDirty
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );
    setDocument(savedContent.blocks);
    replaceBlocks.mockClear();

    rerender(
      <PostBodyEditor
        initialContent={savedContent}
        isDirty={false}
        onChange={() => {}}
        onBlur={() => {}}
      />,
    );

    expect(replaceBlocks).not.toHaveBeenCalled();
    expect(editor.document).toEqual(savedContent.blocks);
  });

  it("uses native block operations and restores focus after a block action", () => {
    const block = {
      id: "paragraph-1",
      type: "paragraph",
      props: {},
      content: "Draft paragraph",
      children: [],
    };
    setSelectedBlocks([block]);
    editor.getNextBlock.mockReturnValue({
      id: "paragraph-2",
      type: "paragraph",
      props: {},
      content: "Adjacent paragraph",
      children: [],
    });
    vi.clearAllMocks();

    render(<PostBodyEditor onChange={() => {}} onBlur={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate block" }));
    expect(insertBlocks).toHaveBeenCalledWith(
      [expect.objectContaining({ id: undefined, content: "Draft paragraph" })],
      block,
      "after",
    );
    expect(editor.focus).toHaveBeenCalled();
    expect(editor.setTextCursorPosition).toHaveBeenCalledWith(
      insertedDuplicate,
      "end",
    );

    fireEvent.click(screen.getByRole("button", { name: "Move block up" }));
    fireEvent.click(screen.getByRole("button", { name: "Move block down" }));
    fireEvent.change(screen.getByLabelText("Turn block into"), {
      target: { value: "heading-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete block" }));

    expect(moveBlocksUp).toHaveBeenCalledWith(block);
    expect(moveBlocksDown).toHaveBeenCalledWith(block);
    expect(updateBlock).toHaveBeenCalledWith(block, {
      type: "heading",
      props: { level: 2 },
    });
    expect(removeBlocks).toHaveBeenCalledWith([block]);
  });

  it("does not delete the only selected block and target its removed cursor", () => {
    const block = {
      id: "only-paragraph",
      type: "paragraph",
      props: {},
      content: "Only block",
      children: [],
    };
    setSelectedBlocks([block]);
    editor.getNextBlock.mockReturnValue(undefined);
    editor.getPrevBlock.mockReturnValue(undefined);
    vi.clearAllMocks();

    render(<PostBodyEditor onChange={() => {}} onBlur={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete block" }));

    expect(removeBlocks).not.toHaveBeenCalled();
    expect(editor.setTextCursorPosition).not.toHaveBeenCalled();
  });

  it("exposes a narrow focus handle for validation orchestration", () => {
    const ref = createRef<PostBodyEditorHandle>();
    vi.clearAllMocks();

    render(<PostBodyEditor ref={ref} onChange={() => {}} onBlur={() => {}} />);

    ref.current?.focus();

    expect(editor.focus).toHaveBeenCalledTimes(1);
  });

  it("renders visible native history controls with their current availability", () => {
    vi.clearAllMocks();

    render(<PostBodyEditor onChange={() => {}} onBlur={() => {}} />);

    const undoButton = screen.getByRole("button", { name: "Undo" });
    const redoButton = screen.getByRole("button", { name: "Redo" });
    expect(undoButton).toBeEnabled();
    expect(redoButton).toBeDisabled();

    fireEvent.click(undoButton);
    fireEvent.click(redoButton);

    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).not.toHaveBeenCalled();
    expect(editor.focus).toHaveBeenCalledTimes(1);
  });

  it("rejects an unsafe manually-authored link without changing selected text", () => {
    vi.clearAllMocks();

    render(<PostBodyEditor onChange={() => {}} onBlur={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Create link" }));
    fireEvent.change(screen.getByLabelText("Link URL"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply link" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use an http, https, or mailto link.",
    );
    expect(editor.createLink).not.toHaveBeenCalled();
    expect(
      editor._tiptapEditor.commands.setTextSelection,
    ).not.toHaveBeenCalled();
  });

  it("edits, removes, and cancels links through the validated controller", () => {
    vi.clearAllMocks();

    render(<PostBodyEditor onChange={() => {}} onBlur={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit link" }));
    fireEvent.change(screen.getByLabelText("Link URL"), {
      target: { value: "https://resonance.example/editor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply link" }));

    expect(editor.editLink).toHaveBeenCalledWith(
      "https://resonance.example/editor",
      "Selected text",
      1,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    expect(editor.deleteLink).toHaveBeenCalledWith(1);
  });
});
