import Link from "next/link";
import { cn } from "@/lib/utils";

interface TagPillProps {
  tag: string;
  /** Optional layout adjustments for the surrounding metadata section. */
  className?: string;
}

const TAG_PILL_CLASSES =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground";

/**
 * Renders a tag that links to blog posts filtered by the tag.
 *
 * @param tag - The tag text and filter value.
 */
export function TagPill({ tag, className }: TagPillProps) {
  return (
    <Link
      href={`/blog?tag=${encodeURIComponent(tag)}`}
      className={cn(
        TAG_PILL_CLASSES,
        "transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        className,
      )}
    >
      {tag}
    </Link>
  );
}

/** A static tag label for cards that must keep a single anchor. */
export function TagLabel({ tag, className }: TagPillProps) {
  return <span className={cn(TAG_PILL_CLASSES, className)}>{tag}</span>;
}
