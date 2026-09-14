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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {isReady ? (
          <>
            <header className="flex flex-col gap-6 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {modeLabels[mode]}
                </p>
                {heading && (
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                    {heading}
                  </h1>
                )}
                {description && (
                  <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {description}
                  </p>
                )}
              </div>
              <div
                className="flex flex-wrap items-center gap-2"
                data-studio-actions="true"
              >
                {actions}
              </div>
            </header>

            {notice}

            <div
              className="mx-auto flex w-full max-w-3xl flex-col gap-6"
              data-studio-canvas="true"
            >
              {title}
              {body}
            </div>

            <details className="mx-auto w-full max-w-3xl border-t pt-5">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                Post details
              </summary>
              <div className="mt-5 flex flex-col gap-6">{details}</div>
            </details>
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
