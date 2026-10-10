"use client";

import Link from "next/link";
import type { Ref } from "react";
import { Heart, MessageSquare } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CoverImage } from "@/components/web/CoverImage";

const managementDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

type PublishedRowProps = {
  post: Pick<
    Doc<"posts">,
    | "_id"
    | "title"
    | "tags"
    | "publishedAt"
    | "createdAt"
    | "updatedAt"
    | "likeCount"
    | "commentCount"
  > & { imageUrl: string | null };
  onDeleteAction: () => void;
  deleting: boolean;
  deleteButtonRef?: Ref<HTMLButtonElement>;
  editLinkRef?: Ref<HTMLAnchorElement>;
};

export function PublishedRow({
  post,
  onDeleteAction,
  deleting,
  deleteButtonRef,
  editLinkRef,
}: PublishedRowProps) {
  const publishedAt = post.publishedAt ?? post.createdAt;
  return (
    <article
      aria-label={post.title}
      aria-busy={deleting}
      className="overflow-hidden rounded-xl border bg-card sm:grid sm:min-w-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-x-4 sm:gap-y-1 sm:overflow-visible sm:rounded-none sm:border-x-0 sm:border-t-0 sm:bg-transparent sm:p-5 sm:transition-colors sm:last:border-b-0 sm:hover:bg-muted/50 sm:focus-within:bg-muted/50 lg:grid-cols-[11rem_minmax(0,1fr)_12rem] lg:items-center"
    >
      <h2 className="truncate px-4 pt-4 text-lg font-semibold leading-7 sm:col-start-2 sm:row-start-1 sm:px-0 sm:pt-0">
        <Link
          href={`/blog/${post._id}`}
          title={post.title}
          className="rounded-sm underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {post.title}
        </Link>
      </h2>
      <div className="flex gap-3 px-4 pt-3 pb-4 sm:contents">
        <div className="relative aspect-video w-1/3 shrink-0 self-start overflow-hidden rounded-md border bg-muted sm:col-start-1 sm:row-span-2 sm:row-start-1 sm:w-full sm:self-center">
          <CoverImage
            src={post.imageUrl}
            alt=""
            sizes="(min-width: 640px) 176px, 33vw"
            className="object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:col-start-2 sm:row-start-2 sm:flex-none">
          <div className="flex h-5 items-center gap-2 overflow-hidden whitespace-nowrap text-xs text-muted-foreground">
            <time
              className="shrink-0"
              dateTime={new Date(publishedAt).toISOString()}
            >
              Published {managementDate.format(publishedAt)}
            </time>
            {post.updatedAt > publishedAt && (
              <>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                <time
                  className="min-w-0 truncate"
                  dateTime={new Date(post.updatedAt).toISOString()}
                >
                  Updated {managementDate.format(post.updatedAt)}
                </time>
              </>
            )}
          </div>
          <div className="flex h-5 items-center overflow-hidden text-xs text-muted-foreground">
            {post.tags.length > 0 ? (
              <p className="truncate">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="mr-3 rounded-sm underline-offset-4 last:mr-0 hover:text-foreground hover:underline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {tag}
                  </Link>
                ))}
              </p>
            ) : (
              <span className="text-muted-foreground/70">No tags</span>
            )}
          </div>
          <div className="flex h-5 items-center overflow-hidden text-xs text-muted-foreground">
            <p
              aria-label="Post engagement"
              className="flex items-center gap-4 overflow-hidden whitespace-nowrap"
            >
              <span className="flex shrink-0 items-center gap-1.5">
                <Heart aria-hidden="true" className="size-3.5 shrink-0" />
                {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <MessageSquare
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
                <span className="truncate">
                  {post.commentCount}{" "}
                  {post.commentCount === 1 ? "comment" : "comments"}
                </span>
              </span>
            </p>
          </div>
        </div>
      </div>
      <div className="border-t sm:col-span-2 sm:row-start-3 sm:flex sm:justify-end sm:border-0 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:self-center">
        <div
          role="group"
          aria-label={`Manage ${post.title}`}
          className="flex sm:inline-flex sm:items-center sm:rounded-lg sm:border sm:bg-card sm:p-0.5"
        >
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="min-h-11 flex-1 rounded-none hover:bg-transparent! hover:text-management-edit sm:min-h-8 sm:flex-none sm:rounded-md"
          >
            <Link
              ref={editLinkRef}
              href={`/create?editPostId=${post._id}`}
              aria-label={`Edit ${post.title}`}
            >
              Edit
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
            onClick={onDeleteAction}
            aria-label={`Delete ${post.title}`}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </article>
  );
}
