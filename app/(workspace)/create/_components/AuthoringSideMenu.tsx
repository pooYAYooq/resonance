"use client";

import type { Block } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  AddBlockButton,
  SideMenu,
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { BlockHandleMenu } from "./BlockHandleMenu";

export function AuthoringDragHandle() {
  const editor = useBlockNoteEditor();
  const sideMenu = useExtension(SideMenuExtension, { editor });
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });

  if (!block) return null;

  return (
    <BlockHandleMenu
      editor={editor}
      block={block as unknown as Block}
      sideMenu={sideMenu}
    />
  );
}

export function AuthoringSideMenu() {
  return (
    <SideMenu>
      <AddBlockButton />
      <AuthoringDragHandle />
    </SideMenu>
  );
}
