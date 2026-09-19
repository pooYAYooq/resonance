import {
  BLOCKNOTE_FORMAT,
  extractStorageMediaIds,
  normalizeBlockNoteDocument,
  type CanonicalBlockNoteDocument,
  type CanonicalInlineContent,
  type CanonicalTextStyle,
} from "./blocknote-contract";
import {
  getCanonicalBodyText,
  getCodePointCount,
  MAX_POST_BLOCKS,
  MAX_POST_CHILDREN_PER_BLOCK,
  MAX_POST_DEPTH,
  MAX_POST_INLINE_NODES,
  MAX_POST_TEXT_CODE_POINTS,
  validatePostCapacity,
} from "./post-capacity";

export {
  BLOCKNOTE_FORMAT,
  getCanonicalBodyText,
  getCodePointCount,
  MAX_POST_BLOCKS,
  MAX_POST_CHILDREN_PER_BLOCK,
  MAX_POST_DEPTH,
  MAX_POST_INLINE_NODES,
  MAX_POST_TEXT_CODE_POINTS,
};

export const MIN_POST_TEXT_LENGTH = 10;
export const MAX_POST_TEXT_LENGTH = MAX_POST_TEXT_CODE_POINTS;
export const MAX_BLOCKS = MAX_POST_BLOCKS;
export const MAX_RECURSION_DEPTH = MAX_POST_DEPTH;
export const MAX_CHILDREN_PER_BLOCK = MAX_POST_CHILDREN_PER_BLOCK;
export const MAX_INLINE_NODES = MAX_POST_INLINE_NODES;

export type PostTextStyle = CanonicalTextStyle;
export type PostInlineContent = CanonicalInlineContent;
/** Broad editor-facing shape; persistence narrows it through the contract. */
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
export type PostImageProps = {
  storageId: string;
  altText: string;
  caption?: string;
};
export type ParsedPostBody =
  | { kind: "structured"; document: BlockNoteDocument }
  | { kind: "invalid" };

export function extractPlainText(blocks: PostBlock[]): string {
  return getCanonicalBodyText(blocks);
}

export function getCompactExcerpt(blocks: PostBlock[]): string {
  const codePoints = Array.from(
    getCanonicalBodyText(blocks, {
      includeImageCaptions: false,
    }),
  );
  return codePoints.length > 280
    ? `${codePoints.slice(0, 279).join("")}…`
    : codePoints.join("");
}

export function isValidBlockNoteDoc(blocks: unknown): blocks is PostBlock[] {
  const document = normalizeBlockNoteDocument({
    format: BLOCKNOTE_FORMAT,
    blocks,
  });
  return (
    document !== null && validatePostCapacity(document as BlockNoteDocument).ok
  );
}

/**
 * Compatibility name for call sites that previously considered only images.
 * The full contract now returns storage-backed image, audio, and video
 * references from the same canonical traversal.
 */
export function extractImageStorageIds(blocks: PostBlock[]): string[] {
  return extractStorageMediaIds(blocks as CanonicalBlockNoteDocument["blocks"]);
}

export { extractStorageMediaIds } from "./blocknote-contract";

export function parsePostBody(
  body: string,
  options: { validateCapacity?: boolean } = {},
): ParsedPostBody {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return { kind: "invalid" };
  }

  const document = normalizeBlockNoteDocument(value);
  if (!document) return { kind: "invalid" };
  if (
    options.validateCapacity !== false &&
    !validatePostCapacity(document as BlockNoteDocument).ok
  ) {
    return { kind: "invalid" };
  }
  return { kind: "structured", document: document as BlockNoteDocument };
}
