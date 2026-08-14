"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultStyleSpecs,
} from "@blocknote/core";
import {
  blockTypeSelectItems,
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useBlockNoteEditor,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { Code2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  BlockNoteDocument,
  PostBlock,
  PostInlineContent,
  PostTextStyle,
} from "@/lib/post-content";

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
            values: [2, 3] as const,
          },
        },
      },
    },
    quote: defaultBlockSpecs.quote,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    codeBlock: defaultBlockSpecs.codeBlock,
    image: defaultBlockSpecs.image,
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
      const key = (item as { key?: unknown }).key;
      if (key === "heading_2" || key === "heading_3") {
        return {
          ...(item as object),
          title: key === "heading_2" ? "Section heading" : "Subheading",
        } as T;
      }
      return item;
    });
}

const APPROVED_BLOCK_TYPES = new Set([
  "paragraph",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "codeBlock",
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
        (value.props?.level === 2 || value.props?.level === 3) &&
        value.props?.isToggleable !== true
      );
    })
    .map((item) => {
      const value = item as { type?: unknown; props?: { level?: unknown } };
      if (value.type === "heading" && value.props?.level === 2) {
        return {
          ...(item as object),
          name: "Section heading",
          props: { level: 2 },
        } as T;
      }
      if (value.type === "heading" && value.props?.level === 3) {
        return {
          ...(item as object),
          name: "Subheading",
          props: { level: 3 },
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

function CuratedFormattingToolbar() {
  const editor = useBlockNoteEditor(editorSchema);

  return (
    <FormattingToolbar
      blockTypeSelectItems={getCuratedBlockTypeSelectItems(
        blockTypeSelectItems(editor.dictionary).concat({
          name: "Code block",
          type: "codeBlock",
          icon: Code2,
        }),
      )}
    />
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
    if (inline.type === "link" && typeof inline.href === "string") {
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
    const name = props.name;
    const caption = props.caption;

    return {
      type: "image",
      props: {
        storageId: typeof url === "string" ? url : "",
        altText: typeof name === "string" ? name : "",
        ...(typeof caption === "string" && caption !== "" && { caption }),
      },
    };
  }

  const normalized: PostBlock = { type: block.type };

  if (block.type === "heading" && typeof block.props.level === "number") {
    normalized.props = { level: block.props.level };
  }
  if (block.type === "codeBlock" && typeof block.props.language === "string") {
    normalized.props = { language: block.props.language };
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
  value: BlockNoteDocument;
  onChange: (value: BlockNoteDocument) => void;
  onBlur: () => void;
  invalid?: boolean;
  labelledBy?: string;
  onUploadSessionCreated?: (sessionId: Id<"pendingUploads">) => void;
};

async function retryFinalize(
  finalizePendingUpload: (args: {
    sessionId: Id<"pendingUploads">;
    storageId: Id<"_storage">;
  }) => Promise<null>,
  args: { sessionId: Id<"pendingUploads">; storageId: Id<"_storage"> },
) {
  try {
    return await finalizePendingUpload(args);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return finalizePendingUpload(args);
  }
}

export default function PostBodyEditor({
  onChange,
  onBlur,
  invalid = false,
  labelledBy,
  onUploadSessionCreated,
}: PostBodyEditorProps) {
  const createPendingUpload = useMutation(api.pendingUploads.createPendingUpload);
  const finalizePendingUpload = useMutation(
    api.pendingUploads.finalizePendingUpload,
  );
  const objectUrls = useRef(new Map<string, string>());
  const onUploadSessionCreatedRef = useRef(onUploadSessionCreated);

  useEffect(() => {
    onUploadSessionCreatedRef.current = onUploadSessionCreated;
  }, [onUploadSessionCreated]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  const editor = useCreateBlockNote({
    schema: editorSchema,
    uploadFile: async (file) => {
      const session = await createPendingUpload({});
      const uploadResult = await fetch(session.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload inline image");
      }

      const result = (await uploadResult.json()) as {
        storageId: Id<"_storage">;
      };
      await retryFinalize(finalizePendingUpload, {
        sessionId: session.sessionId,
        storageId: result.storageId,
      });

      onUploadSessionCreatedRef.current?.(session.sessionId);
      objectUrls.current.set(result.storageId, URL.createObjectURL(file));
      return result.storageId;
    },
    resolveFileUrl: async (storageId) =>
      objectUrls.current.get(storageId) ?? "",
  });

  return (
    <div
      className="min-h-80 rounded-md border border-input bg-background px-3 py-2"
      aria-invalid={invalid}
      aria-labelledby={labelledBy}
    >
      <BlockNoteView
        editor={editor}
        aria-invalid={invalid}
        aria-labelledby={labelledBy}
        onChange={() => {
          onChange({
            format: "blocknote@1",
            blocks: editor.document.map((block) =>
              normalizeBlock(block as EditorBlock),
            ),
          });
        }}
        onBlur={onBlur}
        formattingToolbar={false}
        slashMenu={false}
        linkToolbar
        sideMenu={false}
        filePanel={false}
        tableHandles={false}
        emojiPicker={false}
        comments={false}
      >
        <FormattingToolbarController
          formattingToolbar={CuratedFormattingToolbar}
        />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async () =>
            getCuratedSlashMenuItems(getDefaultReactSlashMenuItems(editor))
          }
        />
      </BlockNoteView>
    </div>
  );
}
