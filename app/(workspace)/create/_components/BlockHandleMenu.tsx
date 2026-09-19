"use client";

import type { Block } from "@blocknote/core";
import { GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { BLOCKNOTE_COLOR_TOKENS } from "@/lib/blocknote-contract";
import { cn } from "@/lib/utils";

type BlockNoteColorToken = (typeof BLOCKNOTE_COLOR_TOKENS)[number];

export type BlockHandleSideMenu = {
  blockDragStart: (
    event: { dataTransfer: DataTransfer | null; clientY: number },
    block: Block,
  ) => void;
  blockDragEnd: () => void;
  freezeMenu: () => void;
  unfreezeMenu: () => void;
};

/**
 * Structural slice of the editor the handle menu needs. Typing the prop this
 * way keeps `BlockHandleMenu` renderable from a `"use client"` entry file
 * without exposing the non-serializable `BlockNoteEditor` class in its props.
 */
export type BlockHandleEditor = {
  getBlock: (blockId: string) => Block | undefined;
  getSelection: () => { blocks?: Block[] } | undefined;
  removeBlocks: (blocks: Block[]) => void;
  updateBlock: (
    block: Block,
    update: { props: Record<string, unknown> },
  ) => void;
};

export type BlockHandleMenuProps = {
  editor: BlockHandleEditor;
  block: Block;
  sideMenu: BlockHandleSideMenu;
};

/**
 * The block handle menu. BlockNote's shadcn side menu wraps a draggable handle
 * in a Base UI menu trigger that opens on mousedown, so pressing to drag opens
 * the menu instead of starting a drag. This adapter keeps the same drag and
 * menu behavior but opens the menu on click through a Radix popover.
 *
 * Kept out of the `"use client"` entry file so Next's client-boundary check
 * does not flag the non-serializable `editor` prop on an exported component.
 */
export function BlockHandleMenu({
  editor,
  block,
  sideMenu,
}: BlockHandleMenuProps) {
  const [open, setOpen] = useState(false);
  const blockProps = block.props as Record<string, unknown>;
  const supportsBackground = "backgroundColor" in blockProps;
  const supportsTextColor = "textColor" in blockProps;
  const currentBackground = blockProps.backgroundColor;
  const currentTextColor = blockProps.textColor;

  // Swatches read the same `--bn-colors-highlights-*` variables the reader and
  // editor use (defined globally in `app/globals.css`), so the preview always
  // matches the applied color in both themes. `default` is the theme's own text
  // color (black in light, white in dark), or no fill for backgrounds.
  const swatchColor = (
    token: BlockNoteColorToken,
    kind: "text" | "background",
  ) => {
    if (token === "default") {
      return kind === "text" ? "var(--foreground)" : "transparent";
    }
    return `var(--bn-colors-highlights-${token}-${kind})`;
  };

  // Radix only calls `onOpenChange` for its own open/close triggers, not when
  // we set the controlled `open` state directly. Closing after an action must
  // therefore unfreeze the side menu itself, or the handle stays stuck open.
  const closeMenu = () => {
    setOpen(false);
    sideMenu.unfreezeMenu();
  };

  // The captured block is a snapshot. The page can replace the document
  // underneath it (hydration), which reassigns block ids, so resolve the live
  // block by id at action time and fall back to the current selection.
  const resolveTarget = () => {
    const direct = editor.getBlock(block.id);
    if (direct) return direct;
    const selected = editor.getSelection()?.blocks;
    return selected?.length === 1 ? selected[0] : undefined;
  };

  const removeBlock = () => {
    const target = resolveTarget();
    if (!target) {
      closeMenu();
      return;
    }
    const selectedBlocks = editor.getSelection()?.blocks;
    const blocksToRemove =
      selectedBlocks &&
      selectedBlocks.some((candidate) => candidate.id === target.id)
        ? selectedBlocks
        : [target];
    editor.removeBlocks(blocksToRemove);
    closeMenu();
  };

  const applyProps = (props: Record<string, unknown>) => {
    const target = resolveTarget();
    if (target) editor.updateBlock(target, { props });
    closeMenu();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) sideMenu.freezeMenu();
        else sideMenu.unfreezeMenu();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Open block menu"
          title="Open block menu"
          draggable
          onDragStart={(event) => sideMenu.blockDragStart(event, block)}
          onDragEnd={sideMenu.blockDragEnd}
        >
          <GripVertical data-test="authoringDragHandle" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-56 p-3">
        <div aria-label="Block menu" className="flex flex-col gap-2.5">
          {supportsBackground && (
            <div className="flex flex-col gap-1.5">
              <div className="px-0.5 text-xs font-medium text-muted-foreground">
                Background
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {BLOCKNOTE_COLOR_TOKENS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Background ${color}`}
                    aria-pressed={currentBackground === color}
                    className={cn(
                      "size-5 rounded-full border border-border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      currentBackground === color &&
                        "ring-2 ring-ring ring-offset-1 ring-offset-popover",
                    )}
                    style={{
                      backgroundColor: swatchColor(color, "background"),
                    }}
                    onClick={() => applyProps({ backgroundColor: color })}
                  />
                ))}
              </div>
            </div>
          )}
          {supportsTextColor && (
            <div className="flex flex-col gap-1.5">
              <div className="px-0.5 text-xs font-medium text-muted-foreground">
                Text
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {BLOCKNOTE_COLOR_TOKENS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Text ${color}`}
                    aria-pressed={currentTextColor === color}
                    className={cn(
                      "size-5 rounded-full border border-border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      currentTextColor === color &&
                        "ring-2 ring-ring ring-offset-1 ring-offset-popover",
                    )}
                    style={{ backgroundColor: swatchColor(color, "text") }}
                    onClick={() => applyProps({ textColor: color })}
                  />
                ))}
              </div>
            </div>
          )}
          {(supportsBackground || supportsTextColor) && <Separator />}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={removeBlock}
          >
            <Trash2 className="size-3" />
            Delete block
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
