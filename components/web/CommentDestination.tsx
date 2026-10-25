"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { CommentCard } from "./CommentCard";
import { CommentComposer } from "./CommentComposer";

type Destination = FunctionReturnType<
  typeof api.comments.getCommentDestination
>;

/** Server data makes the selected comment part of the first destination render. */
export function CommentDestination({
  postId,
  commentId,
  initialData,
}: {
  postId: string;
  commentId: string;
  initialData: Destination;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    // Drawer presence includes its exit animation and Radix focus scope.
    const cleanup = () => {
      observer.disconnect();
      clearTimeout(timeout);
      document.removeEventListener("pointerdown", cleanup, true);
      document.removeEventListener("keydown", cleanup, true);
    };
    const focusDestination = () => {
      if (document.querySelector("[data-notification-drawer]")) return;
      cleanup();
      const comment = document.getElementById(`comment-${commentId}`);
      const target =
        comment && root.current?.contains(comment)
          ? comment
          : root.current?.querySelector<HTMLElement>(
              "[data-destination-heading]",
            );
      target?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", cleanup, true);
    document.addEventListener("keydown", cleanup, true);
    const observer = new MutationObserver(focusDestination);
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = setTimeout(cleanup, 1000);
    focusDestination();
    return cleanup;
  }, [postId, commentId]);
  const { isLoading } = useConvexAuth();
  const live = useQuery(
    api.comments.getCommentDestination,
    isLoading ? "skip" : { postId, commentId },
  );
  const data = live === undefined ? initialData : live;
  const destination = `/blog/${postId}/comments/${commentId}`;
  if (!data)
    return (
      <section
        ref={root}
        data-notification-destination={destination}
        className="mx-auto w-full max-w-175 py-6"
      >
        <h1
          tabIndex={-1}
          data-destination-heading
          className="text-2xl font-semibold"
        >
          Post unavailable
        </h1>
        <p className="mt-3 text-muted-foreground">
          This post may have been removed or is no longer published.
        </p>
        <Link
          href="/blog"
          className="mt-4 inline-block underline underline-offset-4"
        >
          Discover posts
        </Link>
      </section>
    );
  const renderComment = (
    comment: NonNullable<Destination>["nearby"][number],
  ) => <CommentCard key={comment._id} {...comment} commentId={comment._id} />;
  return (
    <section
      ref={root}
      data-notification-destination={destination}
      className="mx-auto w-full max-w-175 space-y-6 py-6"
    >
      <header className="space-y-2 border-b pb-4">
        <p className="text-sm text-muted-foreground">Conversation on</p>
        <h1 className="line-clamp-2 font-serif text-2xl font-semibold">
          {data.post.title}
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            By {data.post.authorName}
          </span>
          <Link
            href={`/blog/${data.post.id}`}
            className="underline underline-offset-4"
          >
            Read full post
          </Link>
        </div>
      </header>
      <section aria-label="Comment" className="space-y-3">
        <h2
          tabIndex={-1}
          data-destination-heading
          className="text-sm font-semibold"
        >
          Comment
        </h2>
        {data.comment ? (
          renderComment(data.comment)
        ) : (
          <p role="status" className="text-muted-foreground">
            This comment is no longer available.
          </p>
        )}
      </section>
      <CommentComposer postId={data.post.id} />
      {data.nearby.length > 0 && (
        <section aria-label="Nearby comments" className="space-y-3">
          <h2 className="text-lg font-semibold">Nearby comments</h2>
          {data.nearby.map(renderComment)}
        </section>
      )}
      <Link
        href={`/blog/${data.post.id}#comments`}
        className="inline-block text-sm underline underline-offset-4"
      >
        View all comments
      </Link>
    </section>
  );
}
