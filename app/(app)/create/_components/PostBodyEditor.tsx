"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultStyleSpecs,
} from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import type {
  BlockNoteDocument,
  PostBlock,
  PostInlineContent,
  PostTextStyle,
} from "@/lib/post-content";

const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: {
      ...defaultBlockSpecs.heading,
      config: {
        ...defaultBlockSpecs.heading.config,
        propSchema: {
          ...defaultBlockSpecs.heading.config.propSchema,
          level: {
            default: 1,
            values: [1, 2, 3] as const,
          },
        },
      },
    },
    quote: defaultBlockSpecs.quote,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    codeBlock: defaultBlockSpecs.codeBlock,
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
    strike: defaultStyleSpecs.strike,
    code: defaultStyleSpecs.code,
  },
});

const supportedStyles: PostTextStyle[] = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
];

type EditorBlock = {
  type: string;
  props: Record<string, unknown>;
  content: unknown;
  children: EditorBlock[];
};

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
          content: normalizeInlineContent(inline.content) as PostInlineContent[],
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

function normalizeBlock(block: EditorBlock): PostBlock {
  const normalized: PostBlock = { type: block.type };

  if (block.type === "heading" && typeof block.props.level === "number") {
    normalized.props = { level: block.props.level };
  }
  if (block.type === "codeBlock" && typeof block.props.language === "string") {
    normalized.props = { language: block.props.language };
  }

  if (block.type === "codeBlock") {
    normalized.content =
      typeof block.content === "string" ? block.content : "";
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
};

export default function PostBodyEditor({
  onChange,
  onBlur,
  invalid = false,
  labelledBy,
}: PostBodyEditorProps) {
  const editor = useCreateBlockNote({
    schema: editorSchema,
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
        formattingToolbar
        slashMenu
        linkToolbar
        sideMenu={false}
        filePanel={false}
        tableHandles={false}
        emojiPicker={false}
        comments={false}
      />
    </div>
  );
}
