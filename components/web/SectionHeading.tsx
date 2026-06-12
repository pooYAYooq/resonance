/**
 * Shared heading primitive for surface sections like "Posts" on the
 * profile page and "Fresh from the community" on the landing page.
 *
 * A pure presentational component, no Convex hooks, no auth. Callers
 * pass a title, optional count + label, and an optional right-side
 * action (e.g. a "View All Posts" link).
 */

interface SectionHeadingProps {
  /** Heading text rendered as an <h2>. */
  title: string;
  /** Optional numeric count rendered inline with the label. */
  count?: number;
  /** Optional unit label for the count, e.g. "posts". */
  countLabel?: string;
  /** Optional right-aligned slot, e.g. a "View All Posts" link. */
  action?: React.ReactNode;
}

export function SectionHeading({
  title,
  count,
  countLabel,
  action,
}: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <h2 className="text-2xl font-bold tracking-tight">
        {title}
        {typeof count === "number" && countLabel ? (
          <span className="text-sm text-muted-foreground font-normal">
            {" · "}
            {count} {countLabel}
          </span>
        ) : null}
      </h2>
      {action}
    </div>
  );
}
