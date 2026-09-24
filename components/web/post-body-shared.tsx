import type { ReactNode } from "react";
import type { PostBlock, PostInlineContent } from "@/lib/post-content";
import { DEFAULT_HEADING_LEVEL } from "@/lib/heading";
import { isSafeAuthorLink } from "@/lib/safe-link";

const alignmentClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
} as const;

const headingSizeClass = {
  2: "text-h2",
  3: "text-h3",
  4: "text-h4",
  5: "text-h5",
  6: "text-h6",
} as const;

export function getHeadingClassName(level: unknown): string {
  const resolved =
    typeof level === "number" &&
    Number.isInteger(level) &&
    level >= 2 &&
    level <= 6
      ? (level as keyof typeof headingSizeClass)
      : (DEFAULT_HEADING_LEVEL as keyof typeof headingSizeClass);
  return `${headingSizeClass[resolved]} font-semibold tracking-tight`;
}

/** Normalized `h2`-`h6` tag name; invalid levels fall back to the default. */
export function getHeadingTagName(
  level: unknown,
): "h2" | "h3" | "h4" | "h5" | "h6" {
  const resolved =
    typeof level === "number" &&
    Number.isInteger(level) &&
    level >= 2 &&
    level <= 6
      ? level
      : DEFAULT_HEADING_LEVEL;
  return `h${resolved}` as "h2" | "h3" | "h4" | "h5" | "h6";
}

export function getTextAlignment(props: Record<string, unknown> | undefined) {
  const value = props?.textAlignment;
  return typeof value === "string" && Object.hasOwn(alignmentClass, value)
    ? alignmentClass[value as keyof typeof alignmentClass]
    : alignmentClass.left;
}

/**
 * Block-level color tokens the authoring handle menu persists, as data
 * attributes the reader stylesheet targets (matching inline style rendering).
 * The `default` token means no color and is omitted.
 */
export function getBlockColorAttributes(
  props: Record<string, unknown> | undefined,
): {
  "data-text-color"?: string;
  "data-background-color"?: string;
} {
  const attributes: {
    "data-text-color"?: string;
    "data-background-color"?: string;
  } = {};
  if (typeof props?.textColor === "string" && props.textColor !== "default") {
    attributes["data-text-color"] = props.textColor;
  }
  if (
    typeof props?.backgroundColor === "string" &&
    props.backgroundColor !== "default"
  ) {
    attributes["data-background-color"] = props.backgroundColor;
  }
  return attributes;
}

export function renderInlineContent(
  content: PostInlineContent[] | undefined,
  keyPrefix: string,
): ReactNode[] {
  if (!content) return [];
  return content.map((inline, index) => {
    const key = `${keyPrefix}-${index}`;
    const children =
      inline.type === "link"
        ? renderInlineContent(inline.content, key)
        : inline.text;
    let node: ReactNode = children;
    const styles = inline.styles ?? {};
    if (styles.code) node = <code>{node}</code>;
    if (styles.bold) node = <strong>{node}</strong>;
    if (styles.italic) node = <em>{node}</em>;
    if (styles.underline) node = <u>{node}</u>;
    if (styles.strike) node = <s>{node}</s>;
    if (typeof styles.textColor === "string") {
      node = <span data-text-color={styles.textColor}>{node}</span>;
    }
    if (typeof styles.backgroundColor === "string") {
      node = <span data-background-color={styles.backgroundColor}>{node}</span>;
    }
    if (
      inline.type === "link" &&
      inline.href &&
      isSafeAuthorLink(inline.href)
    ) {
      return (
        <a
          key={key}
          href={inline.href}
          rel="noopener noreferrer nofollow"
          className="underline underline-offset-2 hover:text-primary"
        >
          {node}
        </a>
      );
    }
    return <span key={key}>{node}</span>;
  });
}

export function getInlineText(
  content: PostInlineContent[] | undefined,
): string {
  if (!content) return "";
  return content
    .map((inline) =>
      inline.type === "link" ? getInlineText(inline.content) : inline.text,
    )
    .join("");
}

export function getMediaUrl(
  block: PostBlock,
  resolved: Map<string, string>,
): string | undefined {
  const source = block.props?.source;
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    return undefined;
  }
  const value = source as { kind?: unknown; id?: unknown; url?: unknown };
  if (value.kind === "storage" && typeof value.id === "string") {
    return resolved.get(value.id);
  }
  return value.kind === "url" && typeof value.url === "string"
    ? value.url
    : undefined;
}

type TableCellLike = {
  content?: PostInlineContent[];
  props?: Record<string, unknown>;
};

type TableContentLike = {
  columnWidths?: unknown;
  headerRows?: unknown;
  headerCols?: unknown;
  rows?: unknown;
};

/**
 * Shared table renderer for the public reader and the Review preview, so both
 * keep identical column widths and header semantics. Header rows become
 * `thead` with column-scoped `th`; a configured header column marks the first
 * cell of each body row as a row-scoped `th`.
 */
export function renderTable(block: PostBlock, key: string): ReactNode {
  const table = block.content as unknown as TableContentLike | null;
  if (
    typeof table !== "object" ||
    table === null ||
    !Array.isArray(table.rows)
  ) {
    return null;
  }
  const columnWidths = Array.isArray(table.columnWidths)
    ? table.columnWidths
    : [];
  const headerRows =
    typeof table.headerRows === "number" ? table.headerRows : 0;
  const headerCols =
    typeof table.headerCols === "number" ? table.headerCols : 0;

  const rows = table.rows.map((row, rowIndex) => {
    const cells = (row as { cells?: TableCellLike[] } | undefined)?.cells;
    return (
      <tr key={`${key}-row-${rowIndex}`}>
        {(cells ?? []).map((cell, cellIndex) => {
          const isHeaderRow = rowIndex < headerRows;
          const isHeader = isHeaderRow || cellIndex < headerCols;
          const cellKey = `${key}-${rowIndex}-${cellIndex}`;
          const Cell = (isHeader ? "th" : "td") as "th" | "td";
          return (
            <Cell
              key={cellKey}
              {...(isHeader ? { scope: isHeaderRow ? "col" : "row" } : {})}
              colSpan={
                typeof cell.props?.colspan === "number" ? cell.props.colspan : 1
              }
              rowSpan={
                typeof cell.props?.rowspan === "number" ? cell.props.rowspan : 1
              }
              className={getTextAlignment(cell.props)}
              {...getBlockColorAttributes(cell.props)}
            >
              {renderInlineContent(cell.content, cellKey)}
            </Cell>
          );
        })}
      </tr>
    );
  });

  return (
    <div key={key} className="overflow-x-auto">
      <table>
        {columnWidths.length > 0 ? (
          <colgroup>
            {columnWidths.map((width, index) => (
              <col
                key={`${key}-col-${index}`}
                style={
                  typeof width === "number"
                    ? { width: `${width}px` }
                    : undefined
                }
              />
            ))}
          </colgroup>
        ) : null}
        {headerRows > 0 ? <thead>{rows.slice(0, headerRows)}</thead> : null}
        <tbody>{rows.slice(headerRows)}</tbody>
      </table>
    </div>
  );
}

/**
 * Shared media renderer for the public reader and the Review preview. Honors
 * the persisted `showPreview` flag (falling back to a safe named link) and the
 * bounded `previewWidth` for image and video, so author choices survive into
 * publication. Image/media URLs are validated by the canonical contract and
 * only reach here as storage-resolved or safe HTTP(S) URLs.
 */
export function renderMedia(
  block: PostBlock,
  key: string,
  resolved: Map<string, string>,
): ReactNode {
  const url = getMediaUrl(block, resolved);
  if (!url) return null;
  const props = block.props ?? {};
  const name = typeof props.name === "string" ? props.name : "";
  const caption = typeof props.caption === "string" ? props.caption : "";
  const alignment = getTextAlignment(props);
  const showPreview = props.showPreview !== false;
  const previewWidth =
    typeof props.previewWidth === "number" &&
    Number.isFinite(props.previewWidth)
      ? props.previewWidth
      : undefined;
  const widthStyle =
    previewWidth !== undefined
      ? { width: `${previewWidth}px`, maxWidth: "100%" }
      : undefined;
  const figcaption = caption ? (
    <figcaption className="mt-2 text-small text-muted-foreground">
      {caption}
    </figcaption>
  ) : null;

  if (!showPreview) {
    return (
      <figure
        key={key}
        className={alignment}
        {...getBlockColorAttributes(props)}
      >
        <a
          href={url}
          rel="noopener noreferrer nofollow"
          className="underline underline-offset-2 hover:text-primary"
        >
          {name || caption || url}
        </a>
        {figcaption}
      </figure>
    );
  }

  if (block.type === "image") {
    return (
      <figure
        key={key}
        className={alignment}
        {...getBlockColorAttributes(props)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          style={widthStyle}
          className={widthStyle ? "h-auto" : undefined}
        />
        {figcaption}
      </figure>
    );
  }
  if (block.type === "audio") {
    return (
      <figure key={key} {...getBlockColorAttributes(props)}>
        <audio controls src={url} />
        {figcaption}
      </figure>
    );
  }
  if (block.type === "video") {
    return (
      <figure
        key={key}
        className={alignment}
        {...getBlockColorAttributes(props)}
      >
        <video
          controls
          src={url}
          style={widthStyle}
          className={widthStyle ? "h-auto" : undefined}
        />
        {figcaption}
      </figure>
    );
  }
  return null;
}
