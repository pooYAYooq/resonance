import Link from "next/link";
import type { DiscoverMode } from "@/lib/discover";

interface BlogFilterProps {
  mode: DiscoverMode;
}

/**
 * Displays the active blog topic filter and a link to clear it.
 *
 * @param mode - The normalized Discover mode
 * @returns The filter bar for topic mode, or `null` otherwise
 */
export function BlogFilter({ mode }: BlogFilterProps) {
  if (mode.mode !== "topic") return null;
  const { tag } = mode;

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
