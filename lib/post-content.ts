export const BLOCKNOTE_FORMAT = "blocknote@1" as const;
export const MIN_POST_TEXT_LENGTH = 10;
export const MAX_POST_TEXT_LENGTH = 50_000;
export const MAX_BLOCKS = 100;
export const MAX_RECURSION_DEPTH = 8;
export const MAX_CHILDREN_PER_BLOCK = 20;
export const MAX_INLINE_NODES = 500;

export type PostTextStyle = "bold" | "italic" | "underline" | "strike" | "code";

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
  props?: Record<string, unknown>;
  content?: PostInlineContent[] | string;
  children?: PostBlock[];
};

export type BlockNoteDocument = {
  format: typeof BLOCKNOTE_FORMAT;
  blocks: PostBlock[];
};

export type ParsedPostBody =
  | { kind: "structured"; document: BlockNoteDocument }
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

/**
 * Type guard to check if a value is a record object.
 *
 * @param value - The value to check
 * @returns True if the value is a non-null object that is not an array
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks if a record contains only the specified keys.
 *
 * @param value - The record to check
 * @param keys - The allowed keys
 * @returns True if all keys in the record are in the allowed list
 */
function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/**
 * Validates that a value contains only supported text styles with boolean values.
 *
 * @param value - The value to validate
 * @returns True if the value is a record with only supported style keys and boolean values
 */
function isValidStyles(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return Object.entries(value).every(
    ([key, styleValue]) =>
      SUPPORTED_STYLES.has(key as PostTextStyle) &&
      typeof styleValue === "boolean",
  );
}

/**
 * Validates inline content within a block, ensuring it meets structure and size constraints.
 *
 * @param value - The inline content to validate
 * @param state - Mutable state tracking the number of inline nodes
 * @returns True if the inline content is valid
 */
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
    if (inline.text !== undefined) return false;
    if (!validateInlineContent(inline.content, state)) return false;
  }

  return true;
}

/**
 * Validates the props for a specific block type.
 *
 * @param type - The block type
 * @param value - The props value to validate
 * @returns True if the props are valid for the block type
 */
function validateBlockProps(type: string, value: unknown): boolean {
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

/**
 * Validates a collection of blocks recursively, enforcing depth and count limits.
 *
 * @param value - The blocks to validate
 * @param depth - Current recursion depth
 * @param state - Mutable state tracking blocks, inline nodes, and text length
 * @returns True if the blocks are valid
 */
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

/**
 * Extracts all plain text content from a collection of blocks.
 *
 * @param blocks - The blocks to extract text from
 * @returns Concatenated plain text with normalized whitespace
 */
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

/**
 * Validates that a value is a valid BlockNote document structure.
 *
 * @param blocks - The value to validate
 * @returns True if the value is a valid array of blocks
 */
export function isValidBlockNoteDoc(blocks: unknown): blocks is PostBlock[] {
  const state = { blocks: 0, inlineNodes: 0, textLength: 0 };
  return validateBlocks(blocks, 0, state);
}

/**
 * Extracts all unique image storage IDs from a collection of blocks.
 *
 * @param blocks - The blocks to extract image IDs from
 * @returns Array of unique storage IDs for images
 */
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
        !Object.hasOwn(block, "content") &&
        !Object.hasOwn(block, "children") &&
        validateBlockProps("image", block.props) &&
        isRecord(block.props) &&
        typeof block.props.storageId === "string" &&
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

/**
 * Parses and validates a post body JSON string.
 *
 * @param body - The JSON string to parse
 * @returns Parsed document if valid, or invalid result
 */
export function parsePostBody(body: string): ParsedPostBody {
  let value: unknown;

  try {
    value = JSON.parse(body);
  } catch {
    return { kind: "invalid" };
  }

  if (!isRecord(value) || value.format !== BLOCKNOTE_FORMAT) {
    return { kind: "invalid" };
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
