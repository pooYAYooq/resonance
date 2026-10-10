"use client";

import Link from "next/link";
import type { Ref } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CoverImage } from "@/components/web/CoverImage";

const managementDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

type DraftManagementRowProps = {
  draft: {
    _id: Id<"posts">;
    sourcePostId?: Id<"posts">;
    title: string;
    updatedAt: number;
    tags: string[];
    imageUrl?: string | null;
  };
  onDelete: () => void;
  deleting: boolean;
  deleteButtonRef?: Ref<HTMLButtonElement>;
  resumeLinkRef?: Ref<HTMLAnchorElement>;
};

export function DraftManagementRow({
  draft,
  onDelete,
  deleting,
  deleteButtonRef,
  resumeLinkRef,
}: DraftManagementRowProps) {
  const title = draft.title.trim() || "Untitled draft";
  const resumeHref = draft.sourcePostId
    ? `/create?editPostId=${encodeURIComponent(draft.sourcePostId)}`
    : `/create?draftId=${encodeURIComponent(draft._id)}`;

  return (
    <article
      aria-label={title}
      aria-busy={deleting}
      className="overflow-hidden rounded-xl border bg-card sm:grid sm:min-w-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-x-4 sm:gap-y-1 sm:overflow-visible sm:rounded-none sm:border-x-0 sm:border-t-0 sm:bg-transparent sm:p-5 sm:transition-colors sm:last:border-b-0 sm:hover:bg-muted/50 sm:focus-within:bg-muted/50 lg:grid-cols-[11rem_minmax(0,1fr)_12rem] lg:items-center"
    >
      <h2 className="truncate px-4 pt-4 text-lg font-semibold leading-7 sm:col-start-2 sm:row-start-1 sm:px-0 sm:pt-0">
        <Link
          href={resumeHref}
          title={title}
          className="rounded-sm underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {title}
        </Link>
      </h2>
      <div className="flex gap-3 px-4 pt-3 pb-4 sm:contents">
        <div className="relative aspect-video w-1/3 shrink-0 self-start overflow-hidden rounded-md border bg-muted sm:col-start-1 sm:row-span-2 sm:row-start-1 sm:w-full sm:self-center">
          <CoverImage
            src={draft.imageUrl}
            alt=""
            sizes="(min-width: 640px) 176px, 33vw"
            className="object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:col-start-2 sm:row-start-2 sm:flex-none">
          {draft.sourcePostId && (
            <p className="text-xs text-muted-foreground">Pending update</p>
          )}
          <div className="flex h-5 items-center gap-2 overflow-hidden whitespace-nowrap text-xs text-muted-foreground">
            <time
              className="min-w-0 truncate"
              dateTime={new Date(draft.updatedAt).toISOString()}
            >
              Last saved {managementDate.format(draft.updatedAt)}
            </time>
          </div>
          <div className="flex h-5 items-center overflow-hidden text-xs text-muted-foreground">
            {draft.tags.length > 0 ? (
              <span className="truncate">{draft.tags.join(" · ")}</span>
            ) : (
              <span className="text-muted-foreground/70">No tags</span>
            )}
          </div>
        </div>
      </div>
      <div className="border-t sm:col-span-2 sm:row-start-3 sm:flex sm:justify-end sm:border-0 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:self-center">
        <div
          role="group"
          aria-label={`Manage ${title}`}
          className="flex sm:inline-flex sm:items-center sm:rounded-lg sm:border sm:bg-card sm:p-0.5"
        >
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="min-h-11 flex-1 rounded-none hover:bg-transparent! hover:text-management-edit sm:min-h-8 sm:flex-none sm:rounded-md"
          >
            <Link
              ref={resumeLinkRef}
              href={resumeHref}
              aria-label={`Resume ${title}`}
            >
              Resume
            </Link>
          </Button>
          <Separator orientation="vertical" className="my-2 sm:my-1.5" />
          <Button
            ref={deleteButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 flex-1 cursor-pointer rounded-none hover:bg-transparent! hover:text-destructive sm:min-h-8 sm:flex-none sm:rounded-md"
            disabled={deleting}
            onClick={onDelete}
            aria-label={`Delete ${title}`}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </article>
  );
}
