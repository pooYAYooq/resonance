"use client";

import type { CanonicalProposal } from "@/lib/write-contract";
import { Button } from "@/components/ui/button";
import {
  PostBodyPreview,
  type PreviewInlineImage,
} from "@/components/web/PostBodyPreview";
import type { EditorMode } from "../editorMode";

type ReviewSurfaceProps = {
  mode: EditorMode;
  proposal: CanonicalProposal;
  inlineImages: PreviewInlineImage[];
  coverUrl?: string;
  pending: boolean;
  blockerMessage?: string;
  onBack: () => void;
  onSubmit: () => void;
};

export default function ReviewSurface({
  mode,
  proposal,
  inlineImages,
  coverUrl,
  pending,
  blockerMessage,
  onBack,
  onSubmit,
}: ReviewSurfaceProps) {
  const submitLabel = mode === "published-edit" ? "Update Post" : "Publish";
  const pendingLabel =
    mode === "published-edit" ? "Updating..." : "Publishing...";

  return (
    <section
      data-testid="review-surface"
      data-review-mode={mode}
      className="flex flex-col gap-6"
    >
      <article className="flex flex-col gap-6">
        {coverUrl && (
          // Resolved storage URLs, object URLs, and validated HTTP(S) URLs are safe attributes.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            data-testid="review-cover"
            className="max-h-80 w-full rounded-md border object-cover"
          />
        )}
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {proposal.title}
        </h1>
        <PostBodyPreview body={proposal.body} inlineImages={inlineImages} />
      </article>

      {blockerMessage && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm"
        >
          {blockerMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-5">
        <Button type="button" variant="outline" onClick={onBack}>
          Back to editing
        </Button>
        <Button
          type="button"
          disabled={pending || Boolean(blockerMessage)}
          onClick={onSubmit}
        >
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </section>
  );
}
