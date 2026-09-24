"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import {
  BlockNoteSchema,
  createCodeBlockSpec,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  defaultStyleSpecs,
} from "@blocknote/core";
import { HistoryExtension } from "@blocknote/core/extensions";
import {
  blockTypeSelectItems,
  FormattingToolbar,
  FormattingToolbarController,
  SideMenuController,
  useBlockNoteEditor,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { Redo2, Undo2 } from "lucide-react";
import { useTheme } from "next-themes";
import {
  forwardRef,
  type CSSProperties,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  blockNoteSupportedLanguages,
  normalizeCodeLanguage,
} from "@/lib/code-languages";
import { normalizeBlockNoteDocument } from "@/lib/blocknote-contract";
import {
  DEFAULT_HEADING_LEVEL,
  HEADING_LEVELS,
  normalizeHeadingLevel,
  normalizeHeadingLevels,
} from "@/lib/heading";
import type {
  BlockNoteDocument,
  PostBlock,
  PostInlineContent,
} from "@/lib/post-content";
import { isSafeAuthorLink } from "@/lib/safe-link";
import { createEditorCodeHighlighter } from "@/lib/shiki/highlight-code";
import { useBlockNoteFileUpload } from "@/lib/use-inline-image-upload";
import { AuthoringSideMenu } from "./AuthoringSideMenu";

/**
 * The authoring schema intentionally begins with every installed BlockNote
 * default except standalone files. Headings reserve H1 for the page title;
 * code blocks use the canonical language selector and live Shiki decorations.
 */
const defaultBlockSpecsWithoutFile = Object.fromEntries(
  Object.entries(defaultBlockSpecs).filter(([name]) => name !== "file"),
) as Omit<typeof defaultBlockSpecs, "file">;

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecsWithoutFile,
    heading: createHeadingBlockSpec({
      // BlockNote defaults to H1, which is reserved for the page title.
      defaultLevel: DEFAULT_HEADING_LEVEL,
      levels: HEADING_LEVELS,
      allowToggleHeadings: false,
    }),
    codeBlock: createCodeBlockSpec({
      defaultLanguage: "text",
      supportedLanguages: blockNoteSupportedLanguages,
      createHighlighter: createEditorCodeHighlighter,
    }),
  },
  styleSpecs: defaultStyleSpecs,
});

export { isSafeAuthorLink } from "@/lib/safe-link";

export function BodyFormattingToolbar() {
  const editor = useBlockNoteEditor();
  // The native selector checks prop types, but not allowed level values. Its
  // default heading entries also carry a toggle prop our schema excludes.
  const items = blockTypeSelectItems(editor.dictionary).flatMap((item) => {
    if (item.type !== "heading") return [item];
    const level = item.props?.level;
    if (
      item.props?.isToggleable ||
      !HEADING_LEVELS.some((allowed) => allowed === level)
    )
      return [];
    return [{ ...item, props: { level: level as number } }];
  });
  return <FormattingToolbar blockTypeSelectItems={items} />;
}

/**
 * Persistent visible history controls. BlockNote's default toolbar exposes no
 * undo/redo buttons, so Resonance renders icon buttons driven by the native
 * history extension. Keyboard undo/redo remains untouched.
 */
export function HistoryControls({ resetKey = 0 }: { resetKey?: number }) {
  const editor = useBlockNoteEditor(editorSchema);
  const [, refreshHistory] = useState(0);
  const previousResetKey = useRef(resetKey);
  useEffect(() => {
    if (previousResetKey.current === resetKey) return;
    previousResetKey.current = resetKey;
    // Drop only native history, not the editor or its live uploaded-image URLs.
    editor.unregisterExtension(HistoryExtension);
    editor.registerExtension(HistoryExtension());
    let active = true;
    // Extension reconfiguration does not emit a document-change event.
    queueMicrotask(() => {
      if (active) refreshHistory((value) => value + 1);
    });
    return () => {
      active = false;
    };
  }, [editor, resetKey]);
  const history = editor.getExtension(HistoryExtension);
  const canUndo = history ? editor.canExec(history.undoCommand) : false;
  const canRedo = history ? editor.canExec(history.redoCommand) : false;

  useEffect(
    () => editor.onChange(() => refreshHistory((value) => value + 1)),
    [editor],
  );

  return (
    <div
      className="mb-2 flex items-center gap-1 ps-[15px] sm:ps-[53px]"
      role="toolbar"
      aria-label="Editor history"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Undo"
        title="Undo"
        disabled={!canUndo}
        onClick={() => {
          editor.undo();
          refreshHistory((value) => value + 1);
          editor.focus();
        }}
      >
        <Undo2 />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Redo"
        title="Redo"
        disabled={!canRedo}
        onClick={() => {
          editor.redo();
          refreshHistory((value) => value + 1);
          editor.focus();
        }}
      >
        <Redo2 />
      </Button>
    </div>
  );
}

export function getEditorPasteOptions() {
  return {
    prioritizeMarkdownOverHTML: false,
    plainTextAsMarkdown: true,
  };
}

export type EditorBlock = {
  type: string;
  props: Record<string, unknown>;
  content: unknown;
  children: EditorBlock[];
};

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

function normalizeInlineContent(value: unknown): PostInlineContent[] | string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): PostInlineContent[] => {
    if (typeof item === "string") return [{ type: "text", text: item }];
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }

    const inline = item as Record<string, unknown>;
    if (inline.type === "link") {
      const content = normalizeInlineContent(inline.content);
      if (
        typeof inline.href === "string" &&
        isSafeAuthorLink(inline.href) &&
        Array.isArray(content)
      ) {
        return [{ type: "link", href: inline.href, content }];
      }
      return Array.isArray(content) ? content : [];
    }
    if (inline.type !== "text" || typeof inline.text !== "string") return [];

    return [
      {
        type: "text",
        text: inline.text,
        ...(typeof inline.styles === "object" &&
          inline.styles !== null && {
            styles: inline.styles as PostInlineContent["styles"],
          }),
      },
    ];
  });
}

type ContractBlockInput = {
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: ContractBlockInput[];
};

/**
 * Editor blocks carry live identity (`id`) plus always-present empty props or
 * children. The canonical contract rejects unknown keys, so project only the
 * contract fields before normalizing. Identity is the editor's concern, not
 * persistence.
 */
function toContractBlock(block: EditorBlock): ContractBlockInput {
  return {
    type: block.type,
    ...(block.props &&
      Object.keys(block.props).length > 0 && { props: block.props }),
    ...(block.content !== undefined && {
      content:
        block.type === "codeBlock"
          ? normalizeCodeContent(block.content)
          : block.content,
    }),
    ...(block.children?.length && {
      children: block.children.map(toContractBlock),
    }),
  };
}

/**
 * Projects one live editor block into the canonical contract. The finite
 * contract is the primary path; the fallback below exists only for
 * unsupported input and must never silently discard data for an enabled
 * block.
 */
export function normalizeBlock(block: EditorBlock): PostBlock {
  const canonical = normalizeBlockNoteDocument({
    format: "blocknote@1",
    blocks: [toContractBlock(block)],
  });
  if (canonical) return canonical.blocks[0] as PostBlock;

  const props = { ...block.props };
  if (block.type === "heading")
    props.level = normalizeHeadingLevel(props.level);
  if (block.type === "codeBlock") {
    props.language = normalizeCodeLanguage(props.language);
  }

  const normalized: PostBlock = {
    type: block.type,
    ...(Object.keys(props).length > 0 && { props }),
    content:
      block.type === "codeBlock"
        ? normalizeCodeContent(block.content)
        : normalizeInlineContent(block.content),
  };

  if (block.children?.length) {
    normalized.children = block.children.map(normalizeBlock);
  }
  return normalized;
}

/**
 * Single serialization seam between the live BlockNote document and the
 * canonical `blocknote@1` envelope persisted by the server.
 */
export function serializeEditorDocument(
  blocks: EditorBlock[],
): BlockNoteDocument {
  return {
    format: "blocknote@1",
    blocks: blocks.map((block) => normalizeBlock(block)),
  };
}

export type PostBodyEditorProps = {
  historyResetKey?: number;
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
    objectUrl: string,
  ) => void;
};

export type PostBodyEditorHandle = { focus: () => void };

export function getInitialEditorContent(initialContent?: BlockNoteDocument) {
  const toEditorBlock = (block: PostBlock): PostBlock => {
    const props = { ...block.props };
    const source = props.source;
    if (
      typeof source === "object" &&
      source !== null &&
      !Array.isArray(source) &&
      (source as { kind?: unknown }).kind === "storage" &&
      typeof (source as { id?: unknown }).id === "string"
    ) {
      props.url = (source as { id: string }).id;
      delete props.source;
    }
    if (
      typeof source === "object" &&
      source !== null &&
      !Array.isArray(source) &&
      (source as { kind?: unknown }).kind === "url" &&
      typeof (source as { url?: unknown }).url === "string"
    ) {
      props.url = (source as { url: string }).url;
      delete props.source;
    }
    return {
      ...block,
      ...(Object.keys(props).length > 0 && { props }),
      ...(block.children && { children: block.children.map(toEditorBlock) }),
    };
  };

  return initialContent?.blocks.length
    ? normalizeHeadingLevels(initialContent.blocks).map(toEditorBlock)
    : undefined;
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
      historyResetKey = 0,
      resolvedImageUrls = {},
      onUploadSessionCreated,
    },
    ref,
  ) {
    const { resolvedTheme } = useTheme();
    const editorTheme = resolvedTheme === "dark" ? "dark" : "light";
    const { uploadFile, resolveFileUrl } = useBlockNoteFileUpload({
      resolvedImageUrls,
      onUploadSessionCreated,
    });
    const editor = useCreateBlockNote({
      schema: editorSchema,
      initialContent: getInitialEditorContent(initialContent) as never,
      links: { isValidLink: isSafeAuthorLink },
      pasteHandler: ({ editor, defaultPasteHandler }) => {
        const handled = defaultPasteHandler(getEditorPasteOptions());
        if (handled) {
          // Native paste dispatches directly through ProseMirror. Repair after
          // it finishes, without adding a second undo entry.
          editor.transact((transaction) => {
            normalizeHeadingLevels(editor.document, (block, level) => {
              transaction.setMeta("addToHistory", false);
              editor.updateBlock(block, { props: { level } });
            });
          });
        }
        return handled;
      },
      uploadFile,
      resolveFileUrl,
    });
    const appliedInitialContentKey = useRef<string | undefined>(undefined);

    useImperativeHandle(ref, () => ({ focus: () => editor.focus() }), [editor]);

    useEffect(() => {
      if (!initialContent) return;
      const hydrationKey = JSON.stringify(initialContent);
      if (appliedInitialContentKey.current === hydrationKey) return;
      if (isDirty) {
        appliedInitialContentKey.current = hydrationKey;
        return;
      }
      // Replacing blocks reassigns ids. Skip when the editor already matches
      // the incoming document so open side menus never hold stale ids.
      const currentKey = JSON.stringify(
        serializeEditorDocument(editor.document as unknown as EditorBlock[]),
      );
      if (currentKey === hydrationKey) {
        appliedInitialContentKey.current = hydrationKey;
        return;
      }
      editor.transact((transaction) => {
        transaction.setMeta("addToHistory", false);
        editor.replaceBlocks(
          editor.document,
          (getInitialEditorContent(initialContent) ?? []) as never,
        );
      });
      appliedInitialContentKey.current = hydrationKey;
    }, [editor, initialContent, isDirty]);

    return (
      <div
        className="min-h-80"
        aria-invalid={invalid}
        aria-labelledby={labelledBy}
      >
        <BlockNoteView
          editor={editor}
          theme={editorTheme}
          formattingToolbar={false}
          sideMenu={false}
          style={{ colorScheme: editorTheme } as CSSProperties}
          aria-invalid={invalid}
          aria-labelledby={labelledBy}
          onChange={() =>
            onChange(
              serializeEditorDocument(
                editor.document as unknown as EditorBlock[],
              ),
            )
          }
          onBlur={onBlur}
        >
          <HistoryControls resetKey={historyResetKey} />
          <FormattingToolbarController
            formattingToolbar={BodyFormattingToolbar}
          />
          <SideMenuController sideMenu={AuthoringSideMenu} />
        </BlockNoteView>
      </div>
    );
  },
);

export default PostBodyEditor;
