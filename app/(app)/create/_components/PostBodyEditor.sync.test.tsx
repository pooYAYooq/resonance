import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PostBodyEditor from "./PostBodyEditor";

const { editor, replaceBlocks, setDocument } = vi.hoisted(() => {
  let document: unknown[] = [];
  const replaceBlocks = vi.fn(
    (_blocksToRemove: unknown[], blocksToInsert: unknown[]) => {
      document = [...blocksToInsert];
    },
  );
  const setDocument = (blocks: unknown[]) => {
    document = [...blocks];
  };

  return {
    editor: {
      get document() {
        return document;
      },
      replaceBlocks,
    },
    replaceBlocks,
    setDocument,
  };
});

vi.mock("@blocknote/react", () => ({
  blockTypeSelectItems: [],
  FormattingToolbar: () => null,
  FormattingToolbarController: () => null,
  getDefaultReactSlashMenuItems: () => [],
  SuggestionMenuController: () => null,
  useBlockNoteEditor: () => editor,
  useCreateBlockNote: () => editor,
  useSelectedBlocks: () => [],
}));

vi.mock("@blocknote/shadcn", () => ({
  BlockNoteView: () => null,
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

describe("PostBodyEditor", () => {
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

    expect(replaceBlocks).toHaveBeenCalledWith(
      populatedContent.blocks,
      [],
    );
    expect(editor.document).toEqual([]);
  });
});
