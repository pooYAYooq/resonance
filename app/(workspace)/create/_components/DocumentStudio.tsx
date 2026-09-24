import type { ReactNode } from "react";
import { ChevronDown, PenLine } from "lucide-react";
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
  detailsHidden?: boolean;
  modeLabel?: ReactNode;
  actions?: ReactNode;
};

const modeLabels: Record<EditorMode, string> = {
  new: "New post",
  draft: "Draft",
  "published-edit": "Edit post",
  invalid: "Unavailable",
};

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
  detailsHidden,
  modeLabel,
  actions,
}: DocumentStudioProps) {
  const isReady = state === "ready";

  return (
    <section
      data-testid="document-studio"
      data-editor-mode={mode}
      data-studio-state={state}
      className="flex flex-1 flex-col bg-muted/50"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {isReady ? (
          <>
            <header className="mx-auto flex w-full max-w-5xl flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground"
                  aria-hidden="true"
                >
                  <PenLine className="size-5" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-base font-semibold tracking-tight text-foreground">
                    {modeLabel ?? modeLabels[mode]}
                  </p>
                  {description && (
                    <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
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

            {notice}

            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <main
                aria-label="Writing canvas"
                className="flex w-full flex-col gap-5"
                data-studio-canvas="true"
              >
                {cover && <div className="px-4 sm:px-[54px]">{cover}</div>}
                <div
                  data-studio-title="true"
                  className="px-[15px] pt-4 sm:px-[53px] sm:pt-8"
                >
                  {heading && <h1 className="sr-only">{heading}</h1>}
                  {title}
                </div>
                {body}
              </main>

              {!detailsHidden && (
                <details open className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-border px-4 py-3 text-base font-medium transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
                    <span>Post details</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="mt-4 flex flex-col gap-6">{details}</div>
                </details>
              )}

              {!detailsHidden && (
                <div className="mt-auto flex items-center gap-3 text-small text-muted-foreground">
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  <span>Review when ready.</span>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            className="flex min-h-80 items-center justify-center"
            role="status"
            aria-live="polite"
          >
            {status}
          </div>
        )}
      </div>
    </section>
  );
}
