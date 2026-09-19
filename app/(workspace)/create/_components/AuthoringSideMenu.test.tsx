import { BlockNoteEditor } from "@blocknote/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BlockHandleMenu } from "./BlockHandleMenu";
import { editorSchema } from "./PostBodyEditor";

function buildEditor() {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [{ type: "paragraph", content: "One" }],
  });
}

function sideMenuStub() {
  return {
    blockDragStart: vi.fn(),
    blockDragEnd: vi.fn(),
    freezeMenu: vi.fn(),
    unfreezeMenu: vi.fn(),
  };
}

function renderHandle() {
  const editor = buildEditor();
  const sideMenu = sideMenuStub();
  render(
    <BlockHandleMenu
      editor={editor as never}
      block={editor.document[0] as never}
      sideMenu={sideMenu}
    />,
  );
  return {
    editor,
    sideMenu,
    handle: screen.getByRole("button", { name: "Open block menu" }),
  };
}

describe("block drag handle menu", () => {
  it("does not open on mousedown and opens on a single click", () => {
    const { sideMenu, handle } = renderHandle();

    fireEvent.mouseDown(handle);
    expect(screen.queryByText("Delete block")).toBeNull();

    fireEvent.click(handle);
    expect(screen.getByText("Delete block")).toBeVisible();
    expect(screen.getByText("Delete block").closest("button")).toHaveClass(
      "justify-center",
    );
    expect(sideMenu.freezeMenu).toHaveBeenCalled();
  });

  it("keeps the handle draggable and wires drag to the side menu", () => {
    const { sideMenu, handle } = renderHandle();

    expect(handle).toHaveAttribute("draggable", "true");
    fireEvent.dragStart(handle, { dataTransfer: { setData: vi.fn() } });
    expect(sideMenu.blockDragStart).toHaveBeenCalled();
    fireEvent.dragEnd(handle);
    expect(sideMenu.blockDragEnd).toHaveBeenCalled();
  });

  it("deletes the block from the menu", () => {
    const { editor, sideMenu, handle } = renderHandle();

    fireEvent.click(handle);
    fireEvent.click(screen.getByText("Delete block"));

    expect(editor.document).toHaveLength(1);
    expect(editor.document[0].content).toEqual([]);
    expect(sideMenu.unfreezeMenu).toHaveBeenCalled();
  });

  it("applies a background color to the block", () => {
    const { editor, sideMenu, handle } = renderHandle();

    fireEvent.click(handle);
    fireEvent.click(screen.getByRole("button", { name: "Background red" }));

    expect(
      (editor.document[0].props as Record<string, unknown>).backgroundColor,
    ).toBe("red");
    expect(sideMenu.unfreezeMenu).toHaveBeenCalled();
  });

  it("does not throw when the captured block is stale", () => {
    const editor = buildEditor();
    const sideMenu = sideMenuStub();
    const staleBlock = { ...editor.document[0], id: "stale-block-id" };
    render(
      <BlockHandleMenu
        editor={editor as never}
        block={staleBlock as never}
        sideMenu={sideMenu}
      />,
    );

    const handle = screen.getByRole("button", { name: "Open block menu" });
    fireEvent.click(handle);
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Background red" })),
    ).not.toThrow();

    fireEvent.click(handle);
    expect(() =>
      fireEvent.click(screen.getByText("Delete block")),
    ).not.toThrow();
    expect(editor.document).toHaveLength(1);
  });
});
