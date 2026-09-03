import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TagPill } from "@/components/web/TagPill";
import type { Id } from "@/convex/_generated/dataModel";

type DraftRowProps = {
  draft: {
    _id: Id<"posts">;
    title: string;
    excerpt: string;
    tags: string[];
    updatedAt: number;
  };
  onDelete?: () => void;
  deleting?: boolean;
};

export function DraftRow({ draft, onDelete, deleting }: DraftRowProps) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold">
          {draft.title.trim() || "Untitled draft"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{draft.excerpt}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {draft.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
        <time
          className="mt-3 block text-xs text-muted-foreground"
          dateTime={new Date(draft.updatedAt).toISOString()}
        >
          Updated {new Date(draft.updatedAt).toLocaleDateString()}
        </time>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button asChild variant="outline">
          <Link href={`/create?draftId=${encodeURIComponent(draft._id)}`}>
            Resume
          </Link>
        </Button>
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Delete draft"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
