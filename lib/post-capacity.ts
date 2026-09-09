import type { BlockNoteDocument, PostBlock, PostInlineContent } from "./post-content";

export const MAX_POST_TEXT_CODE_POINTS = 150_000;
export const MAX_POST_SOURCE_BYTES = 838_860;
export const MAX_POST_FINAL_DOCUMENT_BYTES = 838_860;
// Keep Search records below the document ceiling to leave room for index and
// projection overhead; this budget is independent from source capacity.
export const MAX_POST_CORPUS_BYTES = 786_432;
export const MAX_POST_BLOCKS = 100;
export const MAX_POST_INLINE_NODES = 500;
export const MAX_POST_DEPTH = 8;
export const MAX_POST_CHILDREN_PER_BLOCK = 20;
export const MAX_POST_IMAGE_REFERENCES = 100;
export const MAX_POST_URL_CODE_POINTS = 2_048;
export const MAX_POST_ALT_TEXT_CODE_POINTS = 1_000;
export const MAX_POST_CAPTION_CODE_POINTS = 5_000;

export type PostContentMeasurements = {
  textCodePoints: number;
  blockCount: number;
  inlineNodeCount: number;
  maxDepth: number;
  maxChildWidth: number;
  imageReferenceCount: number;
  urlCodePoints: number;
  altTextCodePoints: number;
  captionCodePoints: number;
  maxUrlCodePoints: number;
  maxAltTextCodePoints: number;
  maxCaptionCodePoints: number;
  serializedSourceBytes: number;
  finalDocumentBytes: number;
  serializedCorpusBytes: number;
};

export type PostCorpusInput = {
  sourcePostId?: string;
  title: string;
  bodyText: string;
  authorName: string;
};

export type PostCorpusMeasurements = PostCorpusInput & {
  serializedCorpusBytes: number;
};

export type PostCapacityErrorCategory =
  | "text-code-points"
  | "source-bytes"
  | "block-count"
  | "inline-node-count"
  | "depth"
  | "child-width"
  | "image-reference-count"
  | "url-code-points"
  | "alt-text-code-points"
  | "caption-code-points"
  | "final-document-bytes"
  | "corpus-bytes";

export type PostCapacityError = {
  category: PostCapacityErrorCategory;
  message: string;
};

export type PostCapacityResult =
  | { ok: true; measurements: PostContentMeasurements }
  | { ok: false; error: PostCapacityError; measurements: PostContentMeasurements };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getCodePointCount(value: string): number {
  return Array.from(value).length;
}

/**
 * Produces canonical readable text without including serialized link URLs,
 * image storage IDs, or image alt text.
 */
export function getCanonicalBodyText(
  blocks: PostBlock[],
  options: { includeImageCaptions?: boolean } = {},
): string {
  const includeImageCaptions = options.includeImageCaptions ?? true;
  const parts: string[] = [];
  let depth = 0;

  const getInlineText = (content: unknown): string => {
    if (!Array.isArray(content)) return "";

    const inlineParts: string[] = [];
    for (const inline of content) {
      if (!isRecord(inline)) continue;
      if (inline.type === "link") {
        inlineParts.push(getInlineText(inline.content));
      } else if (typeof inline.text === "string") {
        inlineParts.push(inline.text);
      }
    }
    return inlineParts.join("");
  };

  const visitBlocks = (value: unknown): void => {
    if (!Array.isArray(value) || depth > MAX_POST_DEPTH) return;

    for (const block of value) {
      if (!isRecord(block)) continue;
      if (typeof block.content === "string") {
        parts.push(block.content);
      } else if (
        includeImageCaptions &&
        block.type === "image" &&
        isRecord(block.props) &&
        typeof block.props.caption === "string"
      ) {
        parts.push(block.props.caption);
      } else {
        parts.push(getInlineText(block.content));
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

function getUtf8ByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function measurePostCorpus(
  corpus: PostCorpusInput,
): PostCorpusMeasurements {
  return {
    ...corpus,
    serializedCorpusBytes: getUtf8ByteLength(corpus),
  };
}

function measureInline(
  content: readonly PostInlineContent[] | undefined,
  measurements: PostContentMeasurements,
): void {
  if (!content) return;

  for (const inline of content) {
    measurements.inlineNodeCount += 1;
    if (inline.type === "link") {
      const urlCodePoints = getCodePointCount(inline.href ?? "");
      measurements.urlCodePoints += urlCodePoints;
      measurements.maxUrlCodePoints = Math.max(
        measurements.maxUrlCodePoints,
        urlCodePoints,
      );
      measureInline(inline.content, measurements);
    }
  }
}

function measureBlocks(
  blocks: readonly PostBlock[],
  depth: number,
  measurements: PostContentMeasurements,
): void {
  measurements.maxDepth = Math.max(measurements.maxDepth, depth);

  for (const block of blocks) {
    measurements.blockCount += 1;
    if (block.type === "image") {
      measurements.imageReferenceCount += 1;
      const props = block.props;
      const altTextCodePoints = getCodePointCount(
        typeof props?.altText === "string" ? props.altText : "",
      );
      const captionCodePoints = getCodePointCount(
        typeof props?.caption === "string" ? props.caption : "",
      );
      measurements.altTextCodePoints += altTextCodePoints;
      measurements.captionCodePoints += captionCodePoints;
      measurements.maxAltTextCodePoints = Math.max(
        measurements.maxAltTextCodePoints,
        altTextCodePoints,
      );
      measurements.maxCaptionCodePoints = Math.max(
        measurements.maxCaptionCodePoints,
        captionCodePoints,
      );
    } else if (Array.isArray(block.content)) {
      measureInline(block.content, measurements);
    }

    if (block.children) {
      measurements.maxChildWidth = Math.max(
        measurements.maxChildWidth,
        block.children.length,
      );
      measureBlocks(block.children, depth + 1, measurements);
    }
  }
}

export function measurePostContent(
  document: BlockNoteDocument,
  options: { finalDocument?: unknown; finalDocumentBytes?: number } = {},
): PostContentMeasurements {
  const measurements: PostContentMeasurements = {
    textCodePoints: getCodePointCount(getCanonicalBodyText(document.blocks)),
    blockCount: 0,
    inlineNodeCount: 0,
    maxDepth: 0,
    maxChildWidth: 0,
    imageReferenceCount: 0,
    urlCodePoints: 0,
    altTextCodePoints: 0,
    captionCodePoints: 0,
    maxUrlCodePoints: 0,
    maxAltTextCodePoints: 0,
    maxCaptionCodePoints: 0,
    serializedSourceBytes: getUtf8ByteLength(document),
    finalDocumentBytes: 0,
    serializedCorpusBytes: 0,
  };

  measureBlocks(document.blocks, 0, measurements);
  measurements.finalDocumentBytes =
    options.finalDocumentBytes ??
    getUtf8ByteLength(options.finalDocument ?? document);
  return measurements;
}

function capacityError(
  category: PostCapacityErrorCategory,
  message: string,
  measurements: PostContentMeasurements,
): PostCapacityResult {
  return { ok: false, error: { category, message }, measurements };
}

/**
 * Validates client-observable content limits. The eventual persisted-document
 * size is intentionally not enforced here: the server must measure its actual
 * proposed document with Convex getDocumentSize before writing.
 */
export function validatePostCapacity(
  document: BlockNoteDocument,
  options: {
    finalDocument?: unknown;
    finalDocumentBytes?: number;
    corpus?: PostCorpusInput;
  } = {},
): PostCapacityResult {
  const measurements = measurePostContent(document, options);

  if (measurements.textCodePoints > MAX_POST_TEXT_CODE_POINTS) {
    return capacityError(
      "text-code-points",
      "Content must contain no more than 150,000 readable characters.",
      measurements,
    );
  }
  if (measurements.serializedSourceBytes > MAX_POST_SOURCE_BYTES) {
    return capacityError(
      "source-bytes",
      "Content exceeds the supported serialized source size.",
      measurements,
    );
  }
  if (measurements.finalDocumentBytes > MAX_POST_FINAL_DOCUMENT_BYTES) {
    return capacityError(
      "final-document-bytes",
      "The final stored document exceeds the supported size.",
      measurements,
    );
  }
  if (measurements.imageReferenceCount > MAX_POST_IMAGE_REFERENCES) {
    return capacityError(
      "image-reference-count",
      "Content contains too many image references.",
      measurements,
    );
  }
  if (measurements.blockCount > MAX_POST_BLOCKS) {
    return capacityError("block-count", "Content contains too many blocks.", measurements);
  }
  if (measurements.inlineNodeCount > MAX_POST_INLINE_NODES) {
    return capacityError(
      "inline-node-count",
      "Content contains too many inline nodes.",
      measurements,
    );
  }
  if (measurements.maxDepth > MAX_POST_DEPTH) {
    return capacityError("depth", "Content is nested too deeply.", measurements);
  }
  if (measurements.maxChildWidth > MAX_POST_CHILDREN_PER_BLOCK) {
    return capacityError("child-width", "Content contains too many child blocks.", measurements);
  }
  if (measurements.maxUrlCodePoints > MAX_POST_URL_CODE_POINTS) {
    return capacityError("url-code-points", "A link URL is too long.", measurements);
  }
  if (measurements.maxAltTextCodePoints > MAX_POST_ALT_TEXT_CODE_POINTS) {
    return capacityError(
      "alt-text-code-points",
      "Image alt text is too long.",
      measurements,
    );
  }
  if (measurements.maxCaptionCodePoints > MAX_POST_CAPTION_CODE_POINTS) {
    return capacityError(
      "caption-code-points",
      "Image caption is too long.",
      measurements,
    );
  }

  if (options.corpus) {
    const corpus = measurePostCorpus(options.corpus);
    measurements.serializedCorpusBytes = corpus.serializedCorpusBytes;
    if (corpus.serializedCorpusBytes > MAX_POST_CORPUS_BYTES) {
      return capacityError(
        "corpus-bytes",
        "The complete Search corpus exceeds the supported size.",
        measurements,
      );
    }
  }

  return { ok: true, measurements };
}
