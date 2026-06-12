/**
 * Shared primitive for "no content yet" empty states. Used by the
 * profile page's "No posts yet" placeholder, and later by "No comments
 * yet", empty search results, and similar surfaces.
 *
 * A pure presentational component, no Convex hooks, no auth. Callers
 * pass a lucide icon, title, optional description, and an optional
 * action (typically a `<Button>` or `<Link>`).
 */

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  /**
   * Icon component displayed above the title. Typed as the lucide
   * component shape (`className` + `strokeWidth` props) so plain
   * function components also satisfy it in tests and consumers.
   */
  icon: LucideIcon | React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Primary message. Rendered as bold text. */
  title: string;
  /** Optional supporting copy under the title. */
  description?: string;
  /** Optional CTA below the description (e.g. a Button or Link). */
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-8">
      <Icon className="size-12 text-muted-foreground" strokeWidth={1.5} />
      <p className="text-lg font-semibold">{title}</p>
      {description ? (
        <p className="text-sm text-muted-foreground max-w-prose">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
