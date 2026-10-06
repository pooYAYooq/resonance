"use client";

import type { CanonicalProposal } from "@/lib/write-contract";
import {
  PostBodyPreview,
  type PreviewInlineImage,
} from "@/components/web/PostBodyPreview";
import { PostCover } from "@/components/web/PostCover";
import { PostArticleHeader } from "@/components/web/PostArticleHeader";
import { Separator } from "@/components/ui/separator";
import type { EditorMode } from "../editorMode";

type ReviewSurfaceProps = {
  mode: EditorMode;
  proposal: CanonicalProposal;
  inlineImages: PreviewInlineImage[];
  coverUrl?: string;
  blockerMessage?: string;
  author: {
    userId: string;
    name: string;
    avatarUrl?: string | null;
  };
  published?: { publishedAt: number; updatedAt: number };
};

/**
 * A frozen preview. It renders only the values handed to it, so the page can
 * pass the reviewed snapshot rather than live form state. Actions live in the
 * studio header. The cover hint matches the studio frame (808px inside the
 * `px-4 sm:px-6 lg:px-10` padding), and the prose holds the published 700px
 * measure centred inside that frame — the same 54px gutters the editor gives
 * its canvas.
 */
export default function ReviewSurface({
  mode,
  proposal,
  inlineImages,
  coverUrl,
  blockerMessage,
  author,
  published,
}: ReviewSurfaceProps) {
  return (
    <section className="w-full" data-review-page="true">
      <article
      data-testid="review-surface"
      data-review-mode={mode}
      className="relative mx-auto w-full max-w-7xl px-4 pt-6 pb-8 md:px-6 lg:px-8"
      >
        <PostCover
          src={coverUrl}
          alt={proposal.title}
          className="rounded-xl shadow-sm"
        />
        <PostArticleHeader
          title={proposal.title}
          author={author}
          tags={proposal.tags}
          published={published}
        />
        <Separator className="my-8" orientation="horizontal" decorative={true} />
        <div
          data-testid="review-prose"
          className="mx-auto w-full max-w-175 xl:mx-0"
        >
          <div className="mt-6 max-w-none">
            <PostBodyPreview body={proposal.body} inlineImages={inlineImages} />
          </div>
        </div>

        {blockerMessage && (
          <p
            role="alert"
            className="mt-6 rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm"
          >
            {blockerMessage}
          </p>
        )}
      </article>
    </section>
  );
}
