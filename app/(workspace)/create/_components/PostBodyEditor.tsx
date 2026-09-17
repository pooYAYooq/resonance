"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
  defaultStyleSpecs,
} from "@blocknote/core";
import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import {
  HistoryExtension,
  ShowSelectionExtension,
  SuggestionMenu,
} from "@blocknote/core/extensions";
import {
  blockTypeSelectItems,
  BasicTextStyleButton,
  BlockTypeSelect,
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  LinkToolbarController,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  useComponentsContext,
  useBlockNoteEditor,
  useCreateBlockNote,
  useExtension,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { Link2 } from "lucide-react";
import { useTheme } from "next-themes";
import {
  forwardRef,
  type CSSProperties,
  type FormEvent,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { isSafeAuthorLink } from "@/lib/safe-link";
import {
  blockNoteSupportedLanguages,
  normalizeCodeLanguage,
} from "@/lib/code-languages";
import { createEditorCodeHighlighter } from "@/lib/shiki/highlight-code";
import type {
  BlockNoteDocument,
  PostBlock,
  PostInlineContent,
  PostTextStyle,
} from "@/lib/post-content";
import { useInlineImageUpload } from "@/lib/use-inline-image-upload";
import { useSelectedBlocks } from "@blocknote/react";

const headingPropSchema = { ...defaultBlockSpecs.heading.config.propSchema };
delete headingPropSchema.isToggleable;

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: {
      ...defaultBlockSpecs.heading,
      config: {
        ...defaultBlockSpecs.heading.config,
        propSchema: {
          ...headingPropSchema,
          level: {
            default: 2,
            values: [2, 3, 4, 5, 6] as const,
          },
        },
      },
    },
    quote: defaultBlockSpecs.quote,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    codeBlock: createCodeBlockSpec({
      defaultLanguage: "text",
      supportedLanguages: blockNoteSupportedLanguages,
      createHighlighter: createEditorCodeHighlighter,
    }),
    image: {
      ...defaultBlockSpecs.image,
      config: {
        ...defaultBlockSpecs.image.config,
        propSchema: {
          ...defaultBlockSpecs.image.config.propSchema,
          altText: { default: "" },
        },
      },
    },
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
    strike: defaultStyleSpecs.strike,
    code: defaultStyleSpecs.code,
  },
});

const APPROVED_SLASH_MENU_KEYS = new Set([
  "paragraph",
  "heading_2",
  "heading_3",
  "heading_4",
  "heading_5",
  "heading_6",
  "quote",
  "bullet_list",
  "numbered_list",
  "code_block",
  "image",
]);

export function getCuratedSlashMenuItems<T>(items: T[]): T[] {
  return items
    .filter((item) => {
      const key = (item as { key?: unknown }).key;
      return typeof key === "string" && APPROVED_SLASH_MENU_KEYS.has(key);
    })
    .map((item) => {
      const withoutShortcut = Object.fromEntries(
        Object.entries(item as object).filter(
          ([property]) => property !== "badge",
        ),
      ) as T;
      const key = (item as { key?: unknown }).key;
      if (
        key === "heading_2" ||
        key === "heading_3" ||
        key === "heading_4" ||
        key === "heading_5" ||
        key === "heading_6"
      ) {
        const level = Number(key.slice("heading_".length));
        return {
          ...withoutShortcut,
          title:
            level === 2
              ? "Section heading"
              : level === 3
                ? "Subheading"
                : `Heading ${level}`,
        } as T;
      }
      return withoutShortcut as T;
    });
}

const APPROVED_BLOCK_TYPES = new Set([
  "paragraph",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "image",
]);

export function getCuratedBlockTypeSelectItems<T>(items: T[]): T[] {
  return items
    .filter((item) => {
      const value = item as {
        type?: unknown;
        props?: { level?: unknown; isToggleable?: unknown };
      };

      if (typeof value.type !== "string") return false;
      if (APPROVED_BLOCK_TYPES.has(value.type)) return true;
      return (
        value.type === "heading" &&
        typeof value.props?.level === "number" &&
        value.props.level >= 2 &&
        value.props.level <= 6 &&
        value.props?.isToggleable !== true
      );
    })
    .map((item) => {
      const value = item as { type?: unknown; props?: { level?: unknown } };
      if (value.type === "heading" && typeof value.props?.level === "number") {
        const level = value.props.level;
        return {
          ...(item as object),
          name:
            level === 2
              ? "Section heading"
              : level === 3
                ? "Subheading"
                : `Heading ${level}`,
          props: { level },
        } as T;
      }
      return item;
    });
}

const supportedStyles: PostTextStyle[] = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
];

const TURN_INTO_BLOCKS = {
  paragraph: { label: "Paragraph", update: { type: "paragraph" } },
  "heading-2": {
    label: "Section heading",
    update: { type: "heading", props: { level: 2 } },
  },
  "heading-3": {
    label: "Subheading",
    update: { type: "heading", props: { level: 3 } },
  },
  "heading-4": {
    label: "Heading 4",
    update: { type: "heading", props: { level: 4 } },
  },
  "heading-5": {
    label: "Heading 5",
    update: { type: "heading", props: { level: 5 } },
  },
  "heading-6": {
    label: "Heading 6",
    update: { type: "heading", props: { level: 6 } },
  },
  quote: { label: "Quote", update: { type: "quote" } },
  bullet: { label: "Bulleted list", update: { type: "bulletListItem" } },
  numbered: {
    label: "Numbered list",
    update: { type: "numberedListItem" },
  },
} as const;

type TurnIntoBlockKey = keyof typeof TURN_INTO_BLOCKS;

export function getTurnIntoBlockUpdate(value: string) {
  const option = TURN_INTO_BLOCKS[value as TurnIntoBlockKey];
  return option?.update;
}

/**
 * Keeps all links authored, pasted, or auto-detected within the protocols the
 * reader experience can safely render. BlockNote applies this at each link
 * ingress point, so the editor does not need a competing link implementation.
 */
export { isSafeAuthorLink } from "@/lib/safe-link";

export function getCuratedPasteOptions() {
  return {
    prioritizeMarkdownOverHTML: false,
    plainTextAsMarkdown: true,
  };
}

export function normalizeHeadingLevel(value: unknown): 2 | 3 | 4 | 5 | 6 {
  if (typeof value !== "number" || !Number.isInteger(value)) return 2;
  if (value < 2) return 2;
  if (value > 6) return 6;
  return value as 2 | 3 | 4 | 5 | 6;
}

type EditorHeadingBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: EditorHeadingBlock[];
};

function normalizeEditorHeadingLevels<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
>(editor: BlockNoteEditor<BSchema, ISchema, SSchema>): void {
  const updates: Array<{ id: string; props: Record<string, unknown> }> = [];

  const visit = (blocks: EditorHeadingBlock[]) => {
    for (const block of blocks) {
      if (block.type === "heading") {
        const level = normalizeHeadingLevel(block.props.level);
        if (block.props.level !== level) {
          updates.push({
            id: block.id,
            props: { ...block.props, level },
          });
        }
      }
      visit(block.children);
    }
  };

  visit(editor.document as unknown as EditorHeadingBlock[]);
  if (updates.length === 0) return;

  editor.transact((transaction) => {
    // The correction is an invariant repair, not a second user-editable step.
    transaction.setMeta("addToHistory", false);
    for (const update of updates) {
      editor.updateBlock(update.id, { props: update.props } as never);
    }
  });
}

export type EditorBlock = {
  type: string;
  props: Record<string, unknown>;
  content: unknown;
  children: EditorBlock[];
};

type DuplicableBlock = EditorBlock & { id?: string };

function stripBlockIds(block: DuplicableBlock): DuplicableBlock {
  return {
    ...block,
    id: undefined,
    children: block.children.map(stripBlockIds),
  };
}

function normalizeCodeContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return "";
      }
      const text = (item as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

function CuratedFormattingToolbar() {
  const editor = useBlockNoteEditor(editorSchema);

  return (
    <FormattingToolbar>
      <BlockTypeSelect
        items={getCuratedBlockTypeSelectItems(
          blockTypeSelectItems(editor.dictionary),
        )}
      />
      <BasicTextStyleButton basicTextStyle="bold" />
      <BasicTextStyleButton basicTextStyle="italic" />
      <BasicTextStyleButton basicTextStyle="underline" />
      <BasicTextStyleButton basicTextStyle="strike" />
      <BasicTextStyleButton basicTextStyle="code" />
      <CuratedCreateLinkButton />
    </FormattingToolbar>
  );
}

type LinkRange = { from: number; to: number };

function restoreLinkSelection(
  editor: {
    _tiptapEditor: {
      commands: { setTextSelection: (range: LinkRange) => void };
    };
    focus: () => void;
  },
  range: LinkRange,
) {
  editor._tiptapEditor.commands.setTextSelection(range);
  editor.focus();
}

function CuratedCreateLinkButton() {
  const editor = useBlockNoteEditor(editorSchema);
  const Components = useComponentsContext()!;
  const { showSelection } = useExtension(ShowSelectionExtension);
  const [form, setForm] = useState<
    { range: LinkRange; text: string; url: string } | undefined
  >();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    showSelection(Boolean(form), "curated-create-link");
    return () => showSelection(false, "curated-create-link");
  }, [form, showSelection]);

  const close = () => {
    if (form) restoreLinkSelection(editor, form.range);
    setForm(undefined);
    setError(undefined);
  };

  const open = () => {
    const selection = editor.prosemirrorState.selection;
    setForm({
      range: { from: selection.from, to: selection.to },
      text: editor.getSelectedText(),
      url: "",
    });
    setError(undefined);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    if (!isSafeAuthorLink(form.url)) {
      setError("Use an http, https, or mailto link.");
      return;
    }

    restoreLinkSelection(editor, form.range);
    editor.createLink(form.url, form.text);
    setForm(undefined);
    setError(undefined);
  };

  return (
    <Components.Generic.Popover.Root
      open={Boolean(form)}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) close();
      }}
    >
      <Components.Generic.Popover.Trigger>
        <Components.FormattingToolbar.Button
          className="bn-button"
          icon={<Link2 />}
          label="Create link"
          mainTooltip="Create link"
          onClick={() => (form ? close() : open())}
        />
      </Components.Generic.Popover.Trigger>
      {form && (
        <Components.Generic.Popover.Content
          className="bn-form-popover w-80 max-w-[calc(100vw-2rem)]"
          variant="form-popover"
        >
          <form className="grid gap-2" onSubmit={submit}>
            <label className="sr-only" htmlFor="curated-link-url">
              Link URL
            </label>
            <input
              id="curated-link-url"
              autoFocus
              className="w-full rounded border border-input px-2 py-1 text-sm"
              value={form.url}
              onChange={(event) => {
                const url = event.currentTarget.value;
                setForm((current) => (current ? { ...current, url } : current));
              }}
            />
            <div className="flex justify-end gap-1">
              <button
                type="submit"
                className="rounded px-2 py-1 text-sm hover:bg-muted"
              >
                Apply link
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 text-sm hover:bg-muted"
                onClick={close}
              >
                Cancel link
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
          </form>
        </Components.Generic.Popover.Content>
      )}
    </Components.Generic.Popover.Root>
  );
}

function CuratedLinkToolbar({
  url,
  text,
  range,
  setToolbarOpen,
  setToolbarPositionFrozen,
}: {
  url: string;
  text: string;
  range: LinkRange;
  setToolbarOpen?: (open: boolean) => void;
  setToolbarPositionFrozen?: (frozen: boolean) => void;
}) {
  const editor = useBlockNoteEditor(editorSchema);
  const { showSelection } = useExtension(ShowSelectionExtension);
  const [editing, setEditing] = useState(false);
  const [nextUrl, setNextUrl] = useState(url);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    showSelection(editing, "curated-edit-link");
    return () => showSelection(false, "curated-edit-link");
  }, [editing, showSelection]);

  const close = () => {
    restoreLinkSelection(editor, range);
    setEditing(false);
    setError(undefined);
    setToolbarPositionFrozen?.(false);
    setToolbarOpen?.(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSafeAuthorLink(nextUrl)) {
      setError("Use an http, https, or mailto link.");
      return;
    }
    editor.editLink(nextUrl, text, range.from);
    close();
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded border border-input bg-background p-2 shadow"
      role="toolbar"
      aria-label="Link actions"
    >
      {editing ? (
        <form
          className="grid w-80 max-w-[calc(100vw-2rem)] gap-2"
          onSubmit={submit}
        >
          <label className="sr-only" htmlFor="curated-edit-link-url">
            Link URL
          </label>
          <input
            id="curated-edit-link-url"
            autoFocus
            className="w-full rounded border border-input px-2 py-1 text-sm"
            value={nextUrl}
            onChange={(event) => setNextUrl(event.currentTarget.value)}
          />
          <div className="flex justify-end gap-1">
            <button type="submit">Apply link</button>
            <button type="button" onClick={close}>
              Cancel link
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setToolbarPositionFrozen?.(true);
              setNextUrl(url);
              setEditing(true);
            }}
          >
            Edit link
          </button>
          <button
            type="button"
            onClick={() => {
              editor.deleteLink(range.from);
              close();
            }}
          >
            Remove link
          </button>
        </>
      )}
    </div>
  );
}

function normalizeStyles(
  value: unknown,
): Partial<Record<PostTextStyle, boolean>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const styles: Partial<Record<PostTextStyle, boolean>> = {};
  for (const style of supportedStyles) {
    const styleValue = (value as Record<string, unknown>)[style];
    if (typeof styleValue === "boolean") {
      styles[style] = styleValue;
    }
  }

  return Object.keys(styles).length > 0 ? styles : undefined;
}

function normalizeInlineContent(value: unknown): PostInlineContent[] | string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): PostInlineContent[] => {
    if (typeof item === "string") {
      return [{ type: "text", text: item }];
    }
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }

    const inline = item as Record<string, unknown>;
    if (
      inline.type === "link" &&
      typeof inline.href === "string" &&
      isSafeAuthorLink(inline.href)
    ) {
      return [
        {
          type: "link",
          href: inline.href,
          content: normalizeInlineContent(
            inline.content,
          ) as PostInlineContent[],
        },
      ];
    }
    if (inline.type === "link") {
      return normalizeInlineContent(inline.content) as PostInlineContent[];
    }
    if (inline.type === "text" && typeof inline.text === "string") {
      const styles = normalizeStyles(inline.styles);
      return [
        {
          type: "text",
          text: inline.text,
          ...(styles && { styles }),
        },
      ];
    }

    return [];
  });
}

export function normalizeBlock(block: EditorBlock): PostBlock {
  if (block.type === "image") {
    const props = block.props;
    const url = props.url;
    const altText = props.altText;
    const caption = props.caption;

    return {
      type: "image",
      props: {
        storageId: typeof url === "string" ? url : "",
        altText: typeof altText === "string" ? altText : "",
        ...(typeof caption === "string" && caption !== "" && { caption }),
      },
    };
  }

  const normalized: PostBlock = { type: block.type };

  if (block.type === "heading") {
    normalized.props = { level: normalizeHeadingLevel(block.props.level) };
  }
  if (block.type === "codeBlock") {
    normalized.props = {
      language: normalizeCodeLanguage(block.props.language),
    };
  }

  if (block.type === "codeBlock") {
    normalized.content = normalizeCodeContent(block.content);
  } else {
    normalized.content = normalizeInlineContent(block.content);
  }

  if (block.children.length > 0) {
    normalized.children = block.children.map(normalizeBlock);
  }

  return normalized;
}

export type PostBodyEditorProps = {
  onChange: (value: BlockNoteDocument) => void;
  onBlur: () => void;
  invalid?: boolean;
  isDirty?: boolean;
  labelledBy?: string;
  initialContent?: BlockNoteDocument;
  resolvedImageUrls?: Record<string, string | null>;
  onUploadSessionCreated?: (
    sessionId: Id<"pendingUploads">,
    storageId: Id<"_storage">,
  ) => void;
};

export type PostBodyEditorHandle = {
  focus: () => void;
};

export function getInitialEditorContent(initialContent?: BlockNoteDocument) {
  return initialContent?.blocks.length ? initialContent.blocks : undefined;
}

function InlineImageAltTextControl() {
  const editor = useBlockNoteEditor(editorSchema);
  const selectedBlocks = useSelectedBlocks(editor);
  const image =
    selectedBlocks.length === 1 && selectedBlocks[0].type === "image"
      ? selectedBlocks[0]
      : undefined;

  if (!image) return null;

  const altText =
    typeof image.props.altText === "string" ? image.props.altText : "";

  return (
    <label className="mt-2 block text-sm" htmlFor={`alt-text-${image.id}`}>
      <span className="mb-1 block font-medium">Alt text</span>
      <input
        id={`alt-text-${image.id}`}
        className="w-full rounded-md border border-input bg-background px-3 py-2"
        value={altText}
        placeholder="Describe this image"
        onChange={(event) =>
          editor.updateBlock(image, {
            props: { altText: event.currentTarget.value },
          })
        }
      />
    </label>
  );
}

function CuratedBlockActions() {
  const editor = useBlockNoteEditor(editorSchema);
  const selectedBlocks = useSelectedBlocks(editor);
  const block = selectedBlocks.length === 1 ? selectedBlocks[0] : undefined;

  if (!block) return null;

  const preserveSelection = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
  };
  const completeAction = (action: () => void, target = block) => {
    action();
    editor.setTextCursorPosition(target, "end");
    editor.focus();
  };

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2"
      aria-label="Block actions"
      role="toolbar"
    >
      <button
        type="button"
        className="rounded px-2 py-1 text-sm hover:bg-muted"
        onMouseDown={preserveSelection}
        onClick={() => {
          const duplicate = stripBlockIds(block as DuplicableBlock);
          const [inserted] = editor.insertBlocks(
            [duplicate] as never,
            block,
            "after",
          );
          if (inserted) {
            editor.setTextCursorPosition(inserted, "end");
            editor.focus();
          }
        }}
      >
        Duplicate block
      </button>
      <button
        type="button"
        className="rounded px-2 py-1 text-sm hover:bg-muted"
        onMouseDown={preserveSelection}
        onClick={() => completeAction(() => editor.moveBlocksUp(block))}
      >
        Move block up
      </button>
      <button
        type="button"
        className="rounded px-2 py-1 text-sm hover:bg-muted"
        onMouseDown={preserveSelection}
        onClick={() => completeAction(() => editor.moveBlocksDown(block))}
      >
        Move block down
      </button>
      <label className="sr-only" htmlFor={`turn-into-${block.id}`}>
        Turn block into
      </label>
      <select
        id={`turn-into-${block.id}`}
        className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
        defaultValue=""
        onChange={(event) => {
          const update = getTurnIntoBlockUpdate(event.currentTarget.value);
          if (update) {
            completeAction(() => editor.updateBlock(block, update as never));
          }
          event.currentTarget.value = "";
        }}
      >
        <option value="" disabled>
          Turn into…
        </option>
        {Object.entries(TURN_INTO_BLOCKS).map(([value, option]) => (
          <option key={value} value={value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="rounded px-2 py-1 text-sm text-destructive hover:bg-muted"
        onMouseDown={preserveSelection}
        onClick={() => {
          const adjacentBlock =
            editor.getNextBlock(block) ?? editor.getPrevBlock(block);
          const parentBlock = editor.getParentBlock(block);
          if (!adjacentBlock && parentBlock) {
            completeAction(() => editor.removeBlocks([block]), parentBlock);
            return;
          }
          if (!adjacentBlock) {
            editor.updateBlock(block, {
              type: "paragraph",
              props: {},
              content: "",
              children: [],
            });
            editor.setTextCursorPosition(block, "end");
            editor.focus();
            return;
          }
          completeAction(() => editor.removeBlocks([block]), adjacentBlock);
        }}
      >
        Delete block
      </button>
    </div>
  );
}

function NativeHistoryControls() {
  const editor = useBlockNoteEditor(editorSchema);
  const [, refreshHistory] = useState(0);
  const history = editor.getExtension(HistoryExtension);
  const canUndo = history ? editor.canExec(history.undoCommand) : false;
  const canRedo = history ? editor.canExec(history.redoCommand) : false;

  useEffect(
    () => editor.onChange(() => refreshHistory((value) => value + 1)),
    [editor],
  );

  return (
    <div className="mb-2 flex gap-2" aria-label="Editor history" role="toolbar">
      <button
        type="button"
        className="rounded px-2 py-1 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"
        disabled={!canUndo}
        onClick={() => {
          editor.undo();
          refreshHistory((value) => value + 1);
          editor.focus();
        }}
      >
        Undo
      </button>
      <button
        type="button"
        className="rounded px-2 py-1 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"
        disabled={!canRedo}
        onClick={() => {
          editor.redo();
          refreshHistory((value) => value + 1);
          editor.focus();
        }}
      >
        Redo
      </button>
    </div>
  );
}

function CuratedDragHandleMenu() {
  return null;
}

function CuratedSideMenu() {
  return <SideMenu dragHandleMenu={CuratedDragHandleMenu} />;
}

const PostBodyEditor = forwardRef<PostBodyEditorHandle, PostBodyEditorProps>(
  function PostBodyEditor(
    {
      onChange,
      onBlur,
      invalid = false,
      isDirty = false,
      labelledBy,
      initialContent,
      resolvedImageUrls = {},
      onUploadSessionCreated,
    },
    ref,
  ) {
    const { resolvedTheme } = useTheme();
    const editorTheme = resolvedTheme === "dark" ? "dark" : "light";
    const { uploadFile, resolveFileUrl } = useInlineImageUpload({
      resolvedImageUrls,
      onUploadSessionCreated,
    });

    const editor = useCreateBlockNote({
      schema: editorSchema,
      initialContent: getInitialEditorContent(initialContent) as never,
      links: { isValidLink: isSafeAuthorLink },
      pasteHandler: ({ defaultPasteHandler, editor }) => {
        const handled = defaultPasteHandler(getCuratedPasteOptions()) ?? false;
        if (handled) normalizeEditorHeadingLevels(editor);
        return handled;
      },
      uploadFile,
      resolveFileUrl,
    });
    const appliedInitialContentKey = useRef<string | undefined>(undefined);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editor.focus(),
      }),
      [editor],
    );

    useEffect(() => {
      if (!initialContent) return;
      const hydrationKey = JSON.stringify(initialContent);
      if (appliedInitialContentKey.current === hydrationKey) return;
      if (isDirty) {
        appliedInitialContentKey.current = hydrationKey;
        return;
      }
      const blocks = getInitialEditorContent(initialContent);
      void editor.replaceBlocks(editor.document, (blocks ?? []) as never);
      appliedInitialContentKey.current = hydrationKey;
    }, [editor, initialContent, isDirty]);

    return (
      <div
        className="min-h-80 rounded-md border border-input bg-background px-3 py-2"
        aria-invalid={invalid}
        aria-labelledby={labelledBy}
      >
        <BlockNoteView
          editor={editor}
          theme={editorTheme}
          style={
            {
              colorScheme: editorTheme,
              "--bn-colors-side-menu": "var(--muted-foreground)",
            } as CSSProperties
          }
          aria-invalid={invalid}
          aria-labelledby={labelledBy}
          onChange={() => {
            normalizeEditorHeadingLevels(editor);
            onChange({
              format: "blocknote@1",
              blocks: editor.document.map((block) =>
                normalizeBlock(block as EditorBlock),
              ),
            });
          }}
          onBlur={onBlur}
          onKeyDownCapture={(event) => {
            if (event.key !== "Escape") return;
            if (!editor.getExtension(SuggestionMenu)?.shown()) return;

            event.preventDefault();
            event.stopPropagation();
            editor.getExtension(SuggestionMenu)?.closeMenu();
            requestAnimationFrame(() => {
              editor.focus();
            });
          }}
          formattingToolbar={false}
          slashMenu={false}
          linkToolbar={false}
          sideMenu={false}
          filePanel={false}
          tableHandles={false}
          emojiPicker={false}
          comments={false}
        >
          <NativeHistoryControls />
          <FormattingToolbarController
            formattingToolbar={CuratedFormattingToolbar}
          />
          <LinkToolbarController linkToolbar={CuratedLinkToolbar} />
          <SuggestionMenuController
            triggerCharacter="/"
            floatingUIOptions={{
              elementProps: {
                style: {
                  width: "24rem",
                  maxWidth: "calc(100vw - 2rem)",
                },
              },
            }}
            getItems={async () =>
              getCuratedSlashMenuItems(getDefaultReactSlashMenuItems(editor))
            }
          />
          <SideMenuController sideMenu={CuratedSideMenu} />
          <CuratedBlockActions />
          <InlineImageAltTextControl />
        </BlockNoteView>
      </div>
    );
  },
);

export default PostBodyEditor;
