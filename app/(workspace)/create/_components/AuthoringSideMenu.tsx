"use client";

import type { Block } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  AddBlockButton,
  SideMenu,
  SideMenuController,
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { BlockHandleMenu, type BlockHandleEditor } from "./BlockHandleMenu";

/**
 * BlockNote centers the side menu on a block's first line with a table ported
 * from its default heading scale (H1 39, H2 27, H3 18.5, others 0). The studio
 * flattens headings in `app/globals.css`, so those values leave the handle low
 * on H2-H3 and high on H4-H6. These offsets keep it centered on the editing
 * scale: 18px heading padding + (font-size x line-height - 30px menu) / 2.
 * Keep them in step with the heading rules in `app/globals.css`.
 */
const HEADING_SIDE_MENU_OFFSET: Record<number, number> = {
  2: 16, // 1.25rem x 1.3
  3: 15, // 1.125rem x 1.35
  4: 14, // 1rem x 1.4
  5: 14, // 0.9375rem x 1.45
  6: 13.5, // 0.875rem x 1.5
};

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
      editor={editor as unknown as BlockHandleEditor}
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

/**
 * Renders the authoring side menu and corrects its vertical offset for the
 * studio's flattened heading scale. Every other block keeps BlockNote's
 * defaults.
 */
export function AuthoringSideMenuController() {
  const editor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });
  const headingOffset =
    block?.type === "heading"
      ? (HEADING_SIDE_MENU_OFFSET[Number(block.props.level)] ?? 0)
      : undefined;

  return (
    <SideMenuController
      sideMenu={AuthoringSideMenu}
      floatingUIOptions={
        headingOffset === undefined
          ? undefined
          : {
              useFloatingOptions: {
                middleware: [
                  {
                    name: "studioHeadingOffset",
                    fn: (state) => ({
                      x: state.x,
                      y: state.y + headingOffset,
                    }),
                  },
                ],
              },
            }
      }
    />
  );
}
