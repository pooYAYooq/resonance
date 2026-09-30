"use client";

import type { CanonicalProposal } from "@/lib/write-contract";
import {
  PostBodyPreview,
  type PreviewInlineImage,
} from "@/components/web/PostBodyPreview";
import { PostCover } from "@/components/web/PostCover";
import type { EditorMode } from "../editorMode";

type ReviewSurfaceProps = {
  mode: EditorMode;
  proposal: CanonicalProposal;
  inlineImages: PreviewInlineImage[];
  coverUrl?: string;
  blockerMessage?: string;
};

/**
 * A frozen preview. It renders only the values handed to it, so the page can
 * pass the reviewed snapshot rather than live form state. Actions live in the
 * studio header.
 */
export default function ReviewSurface({
  mode,
  proposal,
  inlineImages,
  coverUrl,
  blockerMessage,
}: ReviewSurfaceProps) {
  return (
    <section
      data-testid="review-surface"
      data-review-mode={mode}
      className="flex flex-col gap-6"
    >
      <article className="flex flex-col gap-6">
        <PostCover
          src={coverUrl}
          alt={proposal.title}
          sizes="(max-width: 1100px) 100vw, 744px"
          className="rounded-md border"
        />
        <h1 className="text-h1 font-bold tracking-tight font-serif">
          {proposal.title}
        </h1>
        {proposal.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {proposal.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div data-testid="review-prose" className="mx-auto w-full max-w-[700px]">
          <PostBodyPreview body={proposal.body} inlineImages={inlineImages} />
        </div>
      </article>

      {blockerMessage && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm"
        >
          {blockerMessage}
        </p>
      )}
    </section>
  );
}
