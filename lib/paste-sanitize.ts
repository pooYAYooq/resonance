import {
  isBlockNoteColorToken,
  isSafeEmbeddedMediaUrl,
} from "./blocknote-contract";

const MEDIA_BLOCK_TYPES = new Set(["image", "audio", "video"]);
const TEXT_ALIGNMENTS = new Set(["left", "center", "right", "justify"]);

export type PastedBlock = {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: PastedBlock[];
};

export type PasteSanitization = {
  blocks: PastedBlock[];
  changedBlockIds: string[];
  droppedMediaIds: string[];
  droppedMediaCount: number;
};

export type PasteSanitizeOptions = {
  /**
   * Media block ids the editor still manages, such as an upload that is in
   * flight or has failed and kept its place. Their temporarily empty source is
   * not treated as pasted foreign media.
   */
  pendingMediaIds?: ReadonlySet<string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasEmptyMediaSource(props: Record<string, unknown>) {
  const source = props.source ?? props.url;
  if (typeof source === "string") return !source.trim();
  if (isRecord(source)) {
    if (source.kind === "storage") {
      return typeof source.id !== "string" || !source.id.trim();
    }
    if (source.kind === "url") {
      return typeof source.url !== "string" || !source.url.trim();
    }
    return true;
  }
  return source === undefined || source === null;
}

/** Ids of media blocks whose source is empty or missing, such as an upload. */
export function collectPendingMediaIds(blocks: PastedBlock[]): Set<string> {
  const ids = new Set<string>();
  const visit = (list: PastedBlock[]) => {
    for (const block of list) {
      if (
        block.id &&
        MEDIA_BLOCK_TYPES.has(block.type) &&
        hasEmptyMediaSource(block.props ?? {})
      ) {
        ids.add(block.id);
      }
      if (block.children) visit(block.children);
    }
  };
  visit(blocks);
  return ids;
}

function valuesDiffer(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function normalizeColor(value: unknown) {
  return isBlockNoteColorToken(value) ? value : "default";
}

function normalizeAlignment(value: unknown) {
  if (value === "start") return "left";
  if (value === "end") return "right";
  return TEXT_ALIGNMENTS.has(value as string) ? value : "left";
}

function sanitizeTextProps(props: Record<string, unknown>) {
  const sanitized = { ...props };
  for (const key of ["backgroundColor", "textColor"]) {
    if (key in sanitized) sanitized[key] = normalizeColor(sanitized[key]);
  }
  if ("textAlignment" in sanitized) {
    sanitized.textAlignment = normalizeAlignment(sanitized.textAlignment);
  }
  return sanitized;
}

function sanitizeInlineContent(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return item;
    }
    const inline = item as Record<string, unknown>;
    const sanitized = { ...inline };
    if (
      typeof sanitized.styles === "object" &&
      sanitized.styles !== null &&
      !Array.isArray(sanitized.styles)
    ) {
      const styles = { ...sanitized.styles } as Record<string, unknown>;
      for (const key of ["backgroundColor", "textColor"]) {
        if (key in styles) styles[key] = normalizeColor(styles[key]);
      }
      sanitized.styles = styles;
    }
    if (Array.isArray(sanitized.content)) {
      sanitized.content = sanitizeInlineContent(sanitized.content);
    }
    return sanitized;
  });
}

function sanitizeTableContent(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const content = { ...value } as Record<string, unknown>;
  if (!Array.isArray(content.rows)) return content;
  content.rows = content.rows.map((row) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return row;
    }
    const sanitizedRow = { ...row } as Record<string, unknown>;
    if (!Array.isArray(sanitizedRow.cells)) return sanitizedRow;
    sanitizedRow.cells = sanitizedRow.cells.map((cell) => {
      if (typeof cell !== "object" || cell === null || Array.isArray(cell)) {
        return cell;
      }
      const sanitizedCell = { ...cell } as Record<string, unknown>;
      if (
        typeof sanitizedCell.props === "object" &&
        sanitizedCell.props !== null &&
        !Array.isArray(sanitizedCell.props)
      ) {
        sanitizedCell.props = sanitizeTextProps(
          sanitizedCell.props as Record<string, unknown>,
        );
      }
      sanitizedCell.content = sanitizeInlineContent(sanitizedCell.content);
      return sanitizedCell;
    });
    return sanitizedRow;
  });
  return content;
}

function hasUnsupportedMediaSource(
  props: Record<string, unknown>,
  allowEmptySource: boolean,
) {
  const source = props.source ?? props.url;
  if (typeof source === "string") {
    if (!source.trim()) return !allowEmptySource;
    return (
      /^[a-z][a-z0-9+.-]*:/i.test(source) && !isSafeEmbeddedMediaUrl(source)
    );
  }
  if (isRecord(source)) {
    if (source.kind === "storage") {
      return typeof source.id !== "string" || !source.id.trim();
    }
    if (source.kind === "url") return !isSafeEmbeddedMediaUrl(source.url);
    return true;
  }
  return true;
}

export function sanitizePastedBlocks(
  blocks: PastedBlock[],
  options: PasteSanitizeOptions = {},
): PasteSanitization {
  const changedBlockIds: string[] = [];
  const droppedMediaIds: string[] = [];
  let droppedMediaCount = 0;

  const sanitizeBlock = (block: PastedBlock): PastedBlock | null => {
    const props = block.props ?? {};
    if (MEDIA_BLOCK_TYPES.has(block.type)) {
      const allowEmptySource =
        block.id !== undefined &&
        (options.pendingMediaIds?.has(block.id) ?? false);
      if (hasUnsupportedMediaSource(props, allowEmptySource)) {
        droppedMediaCount += 1;
        if (block.id) droppedMediaIds.push(block.id);
        return null;
      }
    }
    const sanitizedProps = sanitizeTextProps(props);
    const sanitizedContent =
      block.type === "table"
        ? sanitizeTableContent(block.content)
        : sanitizeInlineContent(block.content);
    const children = block.children
      ?.map(sanitizeBlock)
      .filter((child): child is PastedBlock => child !== null);
    const sanitized: PastedBlock = {
      ...block,
      ...(block.props && { props: sanitizedProps }),
      ...(block.content !== undefined && { content: sanitizedContent }),
      ...(children !== undefined && { children }),
    };

    if (
      block.id &&
      (valuesDiffer(block.props, sanitized.props) ||
        valuesDiffer(block.content, sanitized.content))
    ) {
      changedBlockIds.push(block.id);
    }
    return sanitized;
  };

  return {
    blocks: blocks
      .map(sanitizeBlock)
      .filter((block): block is PastedBlock => block !== null),
    changedBlockIds,
    droppedMediaIds,
    droppedMediaCount,
  };
}
