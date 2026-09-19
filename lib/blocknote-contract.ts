import { normalizeCodeLanguage } from "./code-languages";
import { normalizeHeadingLevels } from "./heading";
import { MAX_POST_BLOCKS, MAX_POST_DEPTH } from "./post-capacity";
import { isSafeAuthorLink } from "./safe-link";

export const BLOCKNOTE_FORMAT = "blocknote@1" as const;

export const BLOCKNOTE_COLOR_TOKENS = [
  "default",
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;

const COLOR_TOKENS = new Set<string>(BLOCKNOTE_COLOR_TOKENS);
const TEXT_ALIGNMENTS = new Set(["left", "center", "right", "justify"]);
const TEXT_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
]);
const MEDIA_BLOCK_TYPES = new Set(["image", "audio", "video"]);
const BLOCK_TYPES = new Set([
  ...TEXT_BLOCK_TYPES,
  ...MEDIA_BLOCK_TYPES,
  "codeBlock",
  "divider",
  "table",
]);

export type CanonicalTextStyle =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "textColor"
  | "backgroundColor";

export type CanonicalInlineContent = {
  type?: "text" | "link";
  text?: string;
  href?: string;
  styles?: Partial<Record<CanonicalTextStyle, boolean | string>>;
  content?: CanonicalInlineContent[];
};

export type CanonicalMediaSource =
  | { kind: "storage"; id: string }
  | { kind: "url"; url: string };

export type CanonicalBlock = {
  type: string;
  props?: Record<string, unknown>;
  content?: CanonicalInlineContent[] | string | CanonicalTableContent;
  children?: CanonicalBlock[];
};

export type CanonicalTableCell = {
  type: "tableCell";
  content: CanonicalInlineContent[];
  props: {
    colspan: number;
    rowspan: number;
    backgroundColor: string;
    textColor: string;
    textAlignment: string;
  };
};

export type CanonicalTableContent = {
  type: "tableContent";
  columnWidths: Array<number | null>;
  headerRows?: number;
  headerCols?: number;
  rows: Array<{ cells: CanonicalTableCell[] }>;
};

export type CanonicalBlockNoteDocument = {
  format: typeof BLOCKNOTE_FORMAT;
  blocks: CanonicalBlock[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isColorToken(value: unknown): value is string {
  return typeof value === "string" && COLOR_TOKENS.has(value);
}

function isTextAlignment(value: unknown): value is string {
  return typeof value === "string" && TEXT_ALIGNMENTS.has(value);
}

export function isSafeEmbeddedMediaUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTextProps(value: unknown, type: string) {
  if (value === undefined) value = {};
  if (!isRecord(value)) return null;
  const keys = ["backgroundColor", "textColor", "textAlignment"];
  if (type === "heading") keys.push("level");
  if (type === "checkListItem") keys.push("checked");
  if (type === "numberedListItem") keys.push("start");
  if (!hasOnlyKeys(value, keys)) return null;

  const backgroundColor = value.backgroundColor ?? "default";
  const textColor = value.textColor ?? "default";
  const textAlignment = value.textAlignment ?? "left";
  if (
    !isColorToken(backgroundColor) ||
    !isColorToken(textColor) ||
    !isTextAlignment(textAlignment)
  ) {
    return null;
  }

  const props: Record<string, unknown> = {
    backgroundColor,
    textColor,
    textAlignment,
  };
  if (type === "heading") {
    // The shared recursive pass below supplies the canonical body level.
    props.level = value.level;
  }
  if (type === "checkListItem") {
    const checked = value.checked ?? false;
    if (typeof checked !== "boolean") return null;
    props.checked = checked;
  }
  if (type === "numberedListItem" && value.start !== undefined) {
    if (
      typeof value.start !== "number" ||
      !Number.isInteger(value.start) ||
      value.start < 1
    ) {
      return null;
    }
    props.start = value.start;
  }
  if (type === "quote") delete props.textAlignment;
  return props;
}

function normalizeMediaSource(value: unknown): CanonicalMediaSource | null {
  if (
    isRecord(value) &&
    value.kind === "storage" &&
    typeof value.id === "string"
  ) {
    return value.id.trim() ? { kind: "storage", id: value.id } : null;
  }
  if (
    isRecord(value) &&
    value.kind === "url" &&
    isSafeEmbeddedMediaUrl(value.url)
  ) {
    return { kind: "url", url: value.url };
  }
  if (typeof value !== "string" || !value.trim()) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return isSafeEmbeddedMediaUrl(value) ? { kind: "url", url: value } : null;
  }
  return isSafeEmbeddedMediaUrl(value)
    ? { kind: "url", url: value }
    : { kind: "storage", id: value };
}

function normalizeMediaProps(value: unknown, type: string) {
  if (!isRecord(value)) return null;
  const supportsAlignment = type === "image" || type === "video";
  const supportsPreview =
    type === "image" || type === "audio" || type === "video";
  const keys = ["url", "source", "name", "caption", "backgroundColor"];
  if (supportsAlignment) keys.push("textAlignment", "previewWidth");
  if (supportsPreview) keys.push("showPreview");
  if (!hasOnlyKeys(value, keys)) return null;
  if (value.url !== undefined && value.source !== undefined) return null;

  const source = normalizeMediaSource(value.source ?? value.url);
  if (!source) return null;
  const name = value.name ?? "";
  const caption = value.caption ?? "";
  const backgroundColor = value.backgroundColor ?? "default";
  if (
    typeof name !== "string" ||
    typeof caption !== "string" ||
    !isColorToken(backgroundColor)
  ) {
    return null;
  }
  const props: Record<string, unknown> = {
    source,
    name,
    caption,
    backgroundColor,
  };
  if (supportsPreview) {
    const showPreview = value.showPreview ?? true;
    if (typeof showPreview !== "boolean") return null;
    props.showPreview = showPreview;
  }
  if (supportsAlignment) {
    const textAlignment = value.textAlignment ?? "left";
    if (!isTextAlignment(textAlignment)) return null;
    props.textAlignment = textAlignment;
    if (value.previewWidth !== undefined) {
      if (
        typeof value.previewWidth !== "number" ||
        !Number.isFinite(value.previewWidth)
      ) {
        return null;
      }
      props.previewWidth = value.previewWidth;
    }
  }
  return props;
}

function normalizeStyles(value: unknown) {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const styles: Record<string, boolean | string> = {};
  for (const [name, styleValue] of Object.entries(value)) {
    if (["bold", "italic", "underline", "strike", "code"].includes(name)) {
      if (typeof styleValue !== "boolean") return null;
      styles[name] = styleValue;
      continue;
    }
    if (name === "textColor" || name === "backgroundColor") {
      if (!isColorToken(styleValue)) return null;
      styles[name] = styleValue;
      continue;
    }
    return null;
  }
  return styles;
}

function normalizeInlineContent(
  value: unknown,
): CanonicalInlineContent[] | null {
  if (!Array.isArray(value)) return null;
  const result: CanonicalInlineContent[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const type = item.type ?? "text";
    if (type === "text") {
      if (
        !hasOnlyKeys(item, ["type", "text", "styles"]) ||
        typeof item.text !== "string"
      ) {
        return null;
      }
      const styles = normalizeStyles(item.styles);
      if (styles === null) return null;
      result.push({ type: "text", text: item.text, ...(styles && { styles }) });
      continue;
    }
    if (type !== "link" || !hasOnlyKeys(item, ["type", "href", "content"])) {
      return null;
    }
    if (typeof item.href !== "string" || !isSafeAuthorLink(item.href))
      return null;
    const content = normalizeInlineContent(item.content);
    if (!content) return null;
    result.push({ type: "link", href: item.href, content });
  }
  return result;
}

function normalizeTableContent(value: unknown): CanonicalTableContent | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "type",
      "columnWidths",
      "headerRows",
      "headerCols",
      "rows",
    ])
  ) {
    return null;
  }
  if (
    value.type !== "tableContent" ||
    !Array.isArray(value.columnWidths) ||
    !Array.isArray(value.rows)
  ) {
    return null;
  }
  if (
    !value.columnWidths.every(
      (width) =>
        width === null ||
        width === undefined ||
        (typeof width === "number" && Number.isFinite(width)),
    )
  )
    return null;
  if (
    ![value.headerRows, value.headerCols].every(
      (count) =>
        count === undefined ||
        (Number.isInteger(count) && (count as number) >= 0),
    )
  )
    return null;
  const rows: CanonicalTableContent["rows"] = [];
  for (const row of value.rows) {
    if (
      !isRecord(row) ||
      !hasOnlyKeys(row, ["cells"]) ||
      !Array.isArray(row.cells) ||
      row.cells.length === 0
    )
      return null;
    const cells: CanonicalTableCell[] = [];
    for (const cell of row.cells) {
      if (
        !isRecord(cell) ||
        !hasOnlyKeys(cell, ["type", "content", "props"]) ||
        cell.type !== "tableCell" ||
        !isRecord(cell.props)
      )
        return null;
      const {
        colspan = 1,
        rowspan = 1,
        backgroundColor = "default",
        textColor = "default",
        textAlignment = "left",
      } = cell.props;
      if (
        typeof colspan !== "number" ||
        typeof rowspan !== "number" ||
        !Number.isInteger(colspan) ||
        !Number.isInteger(rowspan) ||
        colspan < 1 ||
        rowspan < 1 ||
        !isColorToken(backgroundColor) ||
        !isColorToken(textColor) ||
        !isTextAlignment(textAlignment)
      ) {
        return null;
      }
      const content = normalizeInlineContent(cell.content);
      if (!content) return null;
      cells.push({
        type: "tableCell",
        content,
        props: { colspan, rowspan, backgroundColor, textColor, textAlignment },
      });
    }
    rows.push({ cells });
  }
  return {
    type: "tableContent",
    columnWidths: value.columnWidths.map((width) =>
      width === undefined ? null : width,
    ),
    ...(value.headerRows !== undefined && {
      headerRows: value.headerRows as number,
    }),
    ...(value.headerCols !== undefined && {
      headerCols: value.headerCols as number,
    }),
    rows,
  };
}

function normalizeBlock(
  value: unknown,
  depth: number,
  state: { count: number },
): CanonicalBlock | null {
  // Reject before recursing so an untrusted, deeply nested body cannot overflow
  // the stack before `validatePostCapacity` runs.
  if (depth > MAX_POST_DEPTH) return null;
  state.count += 1;
  if (state.count > MAX_POST_BLOCKS) return null;
  if (
    !isRecord(value) ||
    typeof value.type !== "string" ||
    !BLOCK_TYPES.has(value.type)
  )
    return null;
  if (!hasOnlyKeys(value, ["type", "props", "content", "children"]))
    return null;
  const type = value.type;
  let props: Record<string, unknown> | null = {};
  let content: CanonicalBlock["content"] | undefined;

  if (TEXT_BLOCK_TYPES.has(type)) {
    props = normalizeTextProps(value.props, type);
    const normalizedContent = normalizeInlineContent(value.content);
    if (!normalizedContent) return null;
    content = normalizedContent;
  } else if (MEDIA_BLOCK_TYPES.has(type)) {
    if (
      value.content !== undefined ||
      (value.children !== undefined &&
        (!Array.isArray(value.children) || value.children.length > 0))
    ) {
      return null;
    }
    props = normalizeMediaProps(value.props, type);
  } else if (type === "codeBlock") {
    if (
      !isRecord(value.props) ||
      !hasOnlyKeys(value.props, ["language"]) ||
      typeof value.content !== "string"
    )
      return null;
    props = { language: normalizeCodeLanguage(value.props.language) };
    content = value.content;
  } else if (type === "divider") {
    if (
      value.props !== undefined &&
      (!isRecord(value.props) || Object.keys(value.props).length > 0)
    )
      return null;
    if (
      value.content !== undefined ||
      (value.children !== undefined &&
        (!Array.isArray(value.children) || value.children.length > 0))
    ) {
      return null;
    }
  } else {
    if (
      value.props !== undefined &&
      (!isRecord(value.props) ||
        !hasOnlyKeys(value.props, ["textColor"]) ||
        !isColorToken(value.props.textColor ?? "default"))
    )
      return null;
    props = {
      textColor:
        (value.props as Record<string, unknown> | undefined)?.textColor ??
        "default",
    };
    const normalizedContent = normalizeTableContent(value.content);
    if (!normalizedContent) return null;
    content = normalizedContent;
    if (
      value.children !== undefined &&
      (!Array.isArray(value.children) || value.children.length > 0)
    ) {
      return null;
    }
  }
  if (!props || content === null) return null;

  let children: CanonicalBlock[] | undefined;
  if (value.children !== undefined) {
    if (!Array.isArray(value.children)) return null;
    children = [];
    for (const child of value.children) {
      const normalizedChild = normalizeBlock(child, depth + 1, state);
      if (!normalizedChild) return null;
      children.push(normalizedChild);
    }
  }
  return {
    type,
    ...(Object.keys(props).length > 0 && { props }),
    ...(content !== undefined && { content }),
    ...(children?.length && { children }),
  };
}

export function normalizeBlockNoteDocument(
  value: unknown,
): CanonicalBlockNoteDocument | null {
  if (
    !isRecord(value) ||
    value.format !== BLOCKNOTE_FORMAT ||
    !Array.isArray(value.blocks) ||
    value.blocks.length > MAX_POST_BLOCKS ||
    !hasOnlyKeys(value, ["format", "blocks"])
  )
    return null;
  const blocks: CanonicalBlock[] = [];
  const state = { count: 0 };
  for (const block of value.blocks) {
    const normalized = normalizeBlock(block, 1, state);
    if (!normalized) return null;
    blocks.push(normalized);
  }
  return { format: BLOCKNOTE_FORMAT, blocks: normalizeHeadingLevels(blocks) };
}

export function extractStorageMediaIds(
  blocks: readonly CanonicalBlock[],
): string[] {
  const found = new Set<string>();
  const visit = (value: readonly CanonicalBlock[]) => {
    for (const block of value) {
      if (MEDIA_BLOCK_TYPES.has(block.type)) {
        const source = block.props?.source;
        if (
          isRecord(source) &&
          source.kind === "storage" &&
          typeof source.id === "string"
        )
          found.add(source.id);
      }
      if (block.children) visit(block.children);
    }
  };
  visit(blocks);
  return [...found];
}
