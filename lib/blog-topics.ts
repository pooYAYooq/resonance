export type BlogTopic = {
  tag: string;
  publishedCount: number;
};

/**
 * Topics are shown most-used first. Ties fall back to the canonical tag name so
 * the order is stable between the menu and the sidebar.
 */
export function orderBlogTopics<T extends BlogTopic>(
  topics: readonly T[],
): T[] {
  return [...topics].sort(
    (a, b) => b.publishedCount - a.publishedCount || a.tag.localeCompare(b.tag),
  );
}
