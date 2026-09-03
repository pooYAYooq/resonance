import Link from "next/link";

interface BlogFilterProps {
  tag?: string;
}

/**
 * Displays the active blog tag filter and a link to clear it.
 *
 * @param tag - The blog tag currently used to filter posts
 * @returns The filter bar when a tag is provided, or `null` otherwise
 */
export function BlogFilter({ tag }: BlogFilterProps) {
  if (!tag) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-y px-6 py-4">
      <p className="text-sm text-muted-foreground">
        Showing posts tagged{" "}
        <span className="font-medium text-foreground">{tag}</span>
      </p>
      <Link
        href="/blog"
        className="text-sm font-medium text-primary hover:underline"
      >
        Clear filter
      </Link>
    </div>
  );
}
