import type { ReactNode } from "react";
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
  "published-edit": "Published edit",
  invalid: "Unavailable",
};

export default function DocumentStudio({
  mode,
  state = "ready",
  status,
  notice,
  heading,
  description,
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
      className="min-h-full bg-background"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {isReady ? (
          <>
            <header className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {modeLabel ?? modeLabels[mode]}
                </p>
              </div>
              <div
                className="flex flex-wrap items-center gap-2"
                data-studio-actions="true"
              >
                {actions}
              </div>
            </header>

            {notice}

            <main
              aria-label="Writing canvas"
              className="mx-auto flex w-full max-w-5xl flex-col gap-5"
              data-studio-canvas="true"
            >
              <div data-studio-title="true" className="pt-4">
                {heading && <h1 className="sr-only">{heading}</h1>}
                {title}
              </div>
              {description && (
                <p className="px-2.5 text-base leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
              {body}
            </main>

            {!detailsHidden && (
              <details open className="mx-auto w-full max-w-5xl border-t pt-5">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  Post details
                </summary>
                <div className="mt-5 flex flex-col gap-6">{details}</div>
              </details>
            )}
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
