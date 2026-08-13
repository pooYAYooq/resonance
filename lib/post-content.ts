export const BLOCKNOTE_FORMAT = "blocknote@1" as const;
export const MIN_POST_TEXT_LENGTH = 10;
export const MAX_POST_TEXT_LENGTH = 50_000;
export const MAX_BLOCKS = 100;
export const MAX_RECURSION_DEPTH = 8;
export const MAX_CHILDREN_PER_BLOCK = 20;
export const MAX_INLINE_NODES = 500;

export type PostTextStyle =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code";

export type PostInlineContent = {
  type?: "text" | "link";
  text?: string;
  href?: string;
  styles?: Partial<Record<PostTextStyle, boolean>>;
  content?: PostInlineContent[];
};

export type PostImageProps = {
  storageId: string;
  altText: string;
  caption?: string;
};

export type PostBlock = {
  type?: string;
  props?: Record<string, unknown> | PostImageProps;
  content?: PostInlineContent[] | string;
  children?: PostBlock[];
};

export type BlockNoteDocument = {
  format: typeof BLOCKNOTE_FORMAT;
  blocks: PostBlock[];
};

export type ParsedPostBody =
  | { kind: "structured"; document: BlockNoteDocument }
  | { kind: "legacy"; text: string }
  | { kind: "invalid" };

const SUPPORTED_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "codeBlock",
  "image",
]);

const SUPPORTED_STYLES = new Set<PostTextStyle>([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isValidStyles(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return Object.entries(value).every(
    ([key, styleValue]) =>
      SUPPORTED_STYLES.has(key as PostTextStyle) &&
      typeof styleValue === "boolean",
  );
}

function validateInlineContent(
  value: unknown,
  state: { inlineNodes: number },
): boolean {
  if (!Array.isArray(value)) return false;

  for (const inline of value) {
    state.inlineNodes += 1;
    if (state.inlineNodes > MAX_INLINE_NODES) return false;
    if (!isRecord(inline)) return false;

    const type = inline.type ?? "text";
    if (type !== "text" && type !== "link") return false;
    if (!hasOnlyKeys(inline, ["type", "text", "href", "styles", "content"])) {
      return false;
    }
    if (inline.styles !== undefined && !isValidStyles(inline.styles)) {
      return false;
    }

    if (type === "text") {
      if (typeof inline.text !== "string") return false;
      if (inline.href !== undefined || inline.content !== undefined) {
        return false;
      }
      continue;
    }

    if (typeof inline.href !== "string") return false;
    if (!validateInlineContent(inline.content, state)) return false;
  }

  return true;
}

function validateBlockProps(
  type: string,
  value: unknown,
): boolean {
  if (value === undefined) return type !== "image";
  if (!isRecord(value)) return false;

  if (type === "heading") {
    return (
      hasOnlyKeys(value, ["level"]) &&
      (value.level === 1 || value.level === 2 || value.level === 3)
    );
  }

  if (type === "codeBlock") {
    return (
      hasOnlyKeys(value, ["language"]) &&
      (value.language === undefined || typeof value.language === "string")
    );
  }

  if (type === "image") {
    return (
      hasOnlyKeys(value, ["storageId", "altText", "caption"]) &&
      typeof value.storageId === "string" &&
      value.storageId.trim().length > 0 &&
      typeof value.altText === "string" &&
      value.altText.trim().length > 0 &&
      (value.caption === undefined || typeof value.caption === "string")
    );
  }

  return Object.keys(value).length === 0;
}

function validateBlocks(
  value: unknown,
  depth: number,
  state: { blocks: number; inlineNodes: number; textLength: number },
): value is PostBlock[] {
  if (!Array.isArray(value) || depth > MAX_RECURSION_DEPTH) return false;

  for (const block of value) {
    state.blocks += 1;
    if (state.blocks > MAX_BLOCKS || !isRecord(block)) return false;

    const type = block.type;
    if (typeof type !== "string" || !SUPPORTED_BLOCK_TYPES.has(type)) {
      return false;
    }
    if (!hasOnlyKeys(block, ["type", "props", "content", "children"])) {
      return false;
    }
    if (!validateBlockProps(type, block.props)) return false;

    if (type === "image") {
      if (Object.hasOwn(block, "content") || Object.hasOwn(block, "children")) {
        return false;
      }
      if (isRecord(block.props) && typeof block.props.caption === "string") {
        state.textLength += block.props.caption.length;
      }
    } else if (type === "codeBlock") {
      if (typeof block.content !== "string") return false;
      state.textLength += block.content.length;
    } else if (!validateInlineContent(block.content, state)) {
      return false;
    } else {
      state.textLength += extractPlainText([
        { content: block.content as PostInlineContent[] },
      ]).length;
    }

    if (state.textLength > MAX_POST_TEXT_LENGTH) return false;

    if (block.children !== undefined) {
      if (
        !Array.isArray(block.children) ||
        block.children.length > MAX_CHILDREN_PER_BLOCK ||
        !validateBlocks(block.children, depth + 1, state)
      ) {
        return false;
      }
    }
  }

  return true;
}

export function extractPlainText(blocks: PostBlock[]): string {
  const parts: string[] = [];
  let depth = 0;

  const visitInline = (content: unknown): void => {
    if (!Array.isArray(content)) return;

    for (const inline of content) {
      if (!isRecord(inline)) continue;
      if (inline.type === "link") {
        visitInline(inline.content);
      } else if (typeof inline.text === "string") {
        parts.push(inline.text);
      }
    }
  };

  const visitBlocks = (value: unknown): void => {
    if (!Array.isArray(value) || depth > MAX_RECURSION_DEPTH) return;

    for (const block of value) {
      if (!isRecord(block)) continue;
      if (typeof block.content === "string") {
        parts.push(block.content);
      } else if (
        block.type === "image" &&
        isRecord(block.props) &&
        typeof block.props.caption === "string"
      ) {
        parts.push(block.props.caption);
      } else {
        visitInline(block.content);
      }

      if (Array.isArray(block.children)) {
        depth += 1;
        visitBlocks(block.children);
        depth -= 1;
      }
    }
  };

  visitBlocks(blocks);

  return parts
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function isValidBlockNoteDoc(blocks: unknown): blocks is PostBlock[] {
  const state = { blocks: 0, inlineNodes: 0, textLength: 0 };
  return validateBlocks(blocks, 0, state);
}

export function extractImageStorageIds(blocks: PostBlock[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let blockCount = 0;

  const visitBlocks = (value: unknown, depth: number): void => {
    if (!Array.isArray(value) || depth > MAX_RECURSION_DEPTH) return;

    for (const block of value) {
      blockCount += 1;
      if (blockCount > MAX_BLOCKS) return;
      if (!isRecord(block)) continue;

      if (
        block.type === "image" &&
        isRecord(block.props) &&
        typeof block.props.storageId === "string" &&
        block.props.storageId.trim().length > 0 &&
        !seen.has(block.props.storageId)
      ) {
        seen.add(block.props.storageId);
        ids.push(block.props.storageId);
      }

      if (
        Array.isArray(block.children) &&
        block.children.length <= MAX_CHILDREN_PER_BLOCK
      ) {
        visitBlocks(block.children, depth + 1);
      }
    }
  };

  visitBlocks(blocks, 0);
  return ids;
}

export function parsePostBody(body: string): ParsedPostBody {
  let value: unknown;

  try {
    value = JSON.parse(body);
  } catch {
    return { kind: "legacy", text: body };
  }

  if (!isRecord(value) || value.format !== BLOCKNOTE_FORMAT) {
    return { kind: "legacy", text: body };
  }

  if (!isValidBlockNoteDoc(value.blocks)) {
    return { kind: "invalid" };
  }

  return {
    kind: "structured",
    document: {
      format: BLOCKNOTE_FORMAT,
      blocks: value.blocks,
    },
  };
}
