import type { ReactNode } from "react";
import { ChevronDown, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorMode } from "../editorMode";

export type DocumentStudioState =
  | "ready"
  | "loading"
  | "auth"
  | "unavailable"
  | "locked";

type DocumentStudioProps = {
  mode: EditorMode;
  state?: DocumentStudioState;
  status?: ReactNode;
  notice?: ReactNode;
  heading?: ReactNode;
  description?: ReactNode;
  cover?: ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  details?: ReactNode;
  detailsSummary?: ReactNode;
  detailsHidden?: boolean;
  modeLabel?: ReactNode;
  actions?: ReactNode;
  preview?: boolean;
  previewBackAction?: ReactNode;
};

const modeLabels: Record<EditorMode, string> = {
  new: "New post",
  draft: "Draft",
  "published-edit": "Edit post",
  invalid: "Unavailable",
};

const DETAILS_DESCRIPTION =
  "Inline media and the tags readers can use to find this post.";

/**
 * The authoring page: a full-width sticky bar over an open writing page. The
 * document frame holds the cover and title at 808px while the editor body
 * reads at the 700px prose column, and Post details closes the page under a
 * rule instead of a card.
 */
export default function DocumentStudio({
  mode,
  state = "ready",
  status,
  notice,
  heading,
  description,
  cover,
  title,
  body,
  details,
  detailsSummary,
  detailsHidden,
  modeLabel,
  actions,
  preview = false,
  previewBackAction,
}: DocumentStudioProps) {
  const isReady = state === "ready";

  return (
    <section
      data-testid="document-studio"
      data-editor-mode={mode}
      data-studio-state={state}
      className={cn(
        "flex flex-1 flex-col",
        preview ? "bg-background" : "bg-muted/50",
      )}
    >
      {isReady ? (
        <>
          {preview ? (
            <header className="sticky top-0 z-10 border-b border-border bg-background">
              <div className="mx-auto grid min-h-[76px] w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
                <div className="justify-self-start">{previewBackAction}</div>
                <p className="text-base font-medium tracking-tight text-foreground">
                  Preview
                </p>
                <div className="flex justify-self-end">{actions}</div>
              </div>
            </header>
          ) : (
            <header className="sticky top-[var(--workspace-navbar-height,0px)] z-10 flex flex-col gap-3 border-b border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:top-0 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"
                  aria-hidden="true"
                >
                  <PenLine className="size-5" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {modeLabel ?? modeLabels[mode]}
                  </p>
                  {description && (
                    <p className="truncate text-small text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <div
                className="flex shrink-0 flex-wrap items-center gap-2 [&>button]:min-h-11 [&>button]:flex-1 [&>button]:px-4 sm:[&>button]:flex-none"
                data-studio-actions="true"
              >
                {actions}
              </div>
            </header>
          )}

          {/* Keep the body slot at the same React position in both layouts.
              Moving a hidden editor between subtrees still remounts it and
              loses its live document, selection, and undo history. */}
          <div
            className={cn(
              "flex flex-1 flex-col",
              !preview && "px-4 py-8 sm:px-6 lg:px-10 lg:py-12",
            )}
          >
            <div
              className={cn(
                "mx-auto flex w-full flex-1 flex-col",
                !preview && "max-w-[808px]",
              )}
            >
              {notice && (
                <div
                  className={cn(
                    "mb-8",
                    preview &&
                      "mx-auto w-full max-w-7xl px-4 pt-6 md:px-6 lg:px-8",
                  )}
                >
                  {notice}
                </div>
              )}

              <main
                aria-label={preview ? "Post preview" : "Writing canvas"}
                className={cn("flex w-full flex-col", preview && "flex-1")}
                data-studio-canvas={preview ? undefined : "true"}
              >
                {!preview && cover}
                {!preview && (
                  <div
                    data-studio-title="true"
                    className={cover ? "mt-10" : undefined}
                  >
                    {heading && <h1 className="sr-only">{heading}</h1>}
                    {title}
                  </div>
                )}
                <div className={preview ? undefined : "mt-5"}>{body}</div>
              </main>

              {!preview && !detailsHidden && (
                <details
                  open
                  className="group mt-16 border-t border-border pt-6"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <h2
                        id="post-details-heading"
                        className="text-xl font-semibold"
                      >
                        Post details
                      </h2>
                      <span className="mt-1 block max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        {detailsSummary ? (
                          <>
                            <span className="group-open:hidden">
                              {detailsSummary}
                            </span>
                            <span className="hidden group-open:inline">
                              {DETAILS_DESCRIPTION}
                            </span>
                          </>
                        ) : (
                          DETAILS_DESCRIPTION
                        )}
                      </span>
                    </div>
                    <ChevronDown
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="mt-7 flex flex-col gap-8">{details}</div>
                </details>
              )}

              {!preview && !detailsHidden && (
                <div className="mt-10 flex items-center gap-3 text-small text-muted-foreground">
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  <span>Review when ready.</span>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div
          className="flex min-h-80 flex-1 items-center justify-center px-4 py-8"
          role="status"
          aria-live="polite"
        >
          {status}
        </div>
      )}
    </section>
  );
}
