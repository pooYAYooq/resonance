export const HEADING_LEVELS = [2, 3, 4, 5, 6] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];
export const DEFAULT_HEADING_LEVEL: HeadingLevel = 2;

export function normalizeHeadingLevel(value: unknown): HeadingLevel {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return DEFAULT_HEADING_LEVEL;
  }
  return Math.max(2, Math.min(6, value)) as HeadingLevel;
}

type HeadingBlockLike<T> = {
  type?: unknown;
  props?: Record<string, unknown>;
  children?: T[];
};

/** Preserve identity for unchanged branches; never mutate the input tree. */
export function normalizeHeadingLevels<T extends HeadingBlockLike<T>>(
  blocks: T[],
  onFix?: (block: T, level: HeadingLevel) => void,
): T[] {
  let changed = false;
  const result = blocks.map((block) => {
    const children =
      block.children && normalizeHeadingLevels(block.children, onFix);
    const level = normalizeHeadingLevel(block.props?.level);
    const needsLevel = block.type === "heading" && block.props?.level !== level;
    if (!needsLevel && children === block.children) return block;
    changed = true;
    if (needsLevel) onFix?.(block, level);
    return {
      ...block,
      ...(needsLevel && { props: { ...block.props, level } }),
      ...(children && { children }),
    };
  });
  return changed ? result : blocks;
}
