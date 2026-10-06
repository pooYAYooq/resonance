import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DocumentStudio from "./DocumentStudio";

function renderStudio(
  mode: "new" | "draft" | "published-edit",
  actions: React.ReactNode,
) {
  return render(
    <DocumentStudio
      mode={mode}
      title={<input aria-label="Blog title" />}
      body={<div data-testid="body-canvas">Body canvas</div>}
      details={<div>Cover and topics</div>}
      actions={actions}
    />,
  );
}

describe("DocumentStudio", () => {
  it("keeps target confirmation and transition errors actionable in Preview", () => {
    const confirm = vi.fn();
    const view = render(
      <DocumentStudio
        mode="draft"
        preview
        notice={<button onClick={confirm}>Load requested draft</button>}
        body={<p>Reviewed document</p>}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Load requested draft" }),
    );
    expect(confirm).toHaveBeenCalledOnce();
    view.rerender(
      <DocumentStudio
        mode="draft"
        preview
        notice={<p role="alert">Requested draft is unavailable</p>}
        body={<p>Reviewed document</p>}
      />,
    );
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByText("Reviewed document")).toBeVisible();
  });

  it("offsets editing actions by the navbar height but not Preview actions", () => {
    const view = renderStudio("new", <button>Review</button>);
    const editingHeader = screen
      .getByRole("button", { name: "Review" })
      .closest("header");
    // jsdom has no sticky layout. These classes connect the toolbar to the
    // shell's measured height and reset the offset when its navbar is hidden.
    expect(editingHeader).toHaveClass(
      "top-[var(--workspace-navbar-height,0px)]",
      "md:top-0",
    );
    view.rerender(
      <DocumentStudio
        mode="new"
        preview
        body={<p>Preview body</p>}
        actions={<button>Publish</button>}
      />,
    );
    const previewHeader = screen
      .getByRole("button", { name: "Publish" })
      .closest("header");
    expect(previewHeader).toHaveClass("top-0");
    expect(previewHeader).not.toHaveClass(
      "top-[var(--workspace-navbar-height,0px)]",
    );
  });

  it("presents a new document as one full-page studio with one details disclosure", () => {
    renderStudio(
      "new",
      <>
        <button type="button">Save Draft</button>
        <button type="button">Review</button>
        <button type="button">Undo</button>
        <button type="button">Redo</button>
      </>,
    );

    const studio = screen.getByTestId("document-studio");
    expect(studio).toHaveAttribute("data-editor-mode", "new");
    expect(studio).toHaveAttribute("data-studio-state", "ready");
    expect(screen.getByRole("textbox", { name: "Blog title" })).toBeVisible();
    expect(screen.getByTestId("body-canvas")).toBeVisible();
    expect(screen.getByText("Post details")).toBeVisible();
    expect(studio.querySelector("details")).toHaveAttribute("open");
    expect(studio.querySelector("header")).toHaveClass("sticky");
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Review" })).toBeVisible();
    expect(studio.className).not.toContain("rounded-lg");
    expect(screen.getByRole("main", { name: "Writing canvas" })).toBeVisible();
    expect(
      studio.querySelector('[data-studio-title="true"]'),
    ).toBeInTheDocument();
    expect(studio.querySelector('[data-studio-canvas="true"]')).not.toHaveClass(
      "max-w-3xl",
    );
  });

  it("keeps draft actions visible for an existing draft", () => {
    renderStudio(
      "draft",
      <>
        <button type="button">Save Draft</button>
        <button type="button">Review</button>
      </>,
    );

    expect(screen.getByTestId("document-studio")).toHaveAttribute(
      "data-editor-mode",
      "draft",
    );
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Review" })).toBeVisible();
  });

  it("does not add Save Draft to the published-edit action set", () => {
    renderStudio(
      "published-edit",
      <>
        <button type="button">Review Update</button>
        <button type="button">Undo</button>
        <button type="button">Redo</button>
      </>,
    );

    expect(screen.getByTestId("document-studio")).toHaveAttribute(
      "data-editor-mode",
      "published-edit",
    );
    expect(screen.getByRole("button", { name: "Review Update" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
  });

  it("keeps the same studio composition on narrow layouts", () => {
    renderStudio("new", <button type="button">Review</button>);

    const studio = screen.getByTestId("document-studio");
    const header = studio.querySelector("header");
    const canvas = studio.querySelector('[data-studio-canvas="true"]');
    const actions = studio.querySelector('[data-studio-actions="true"]');

    expect(header).toHaveClass("flex-col");
    expect(canvas).toBeInTheDocument();
    expect(actions).toHaveClass("flex-wrap");
    expect(studio.querySelector("details")).toHaveAttribute("open");
    expect(screen.getByText("Post details")).toBeVisible();
  });

  it("frames the writing canvas at the 808px studio measure", () => {
    renderStudio("new", <button type="button">Review</button>);

    expect(
      screen.getByRole("main", { name: "Writing canvas" }).parentElement,
    ).toHaveClass("max-w-[808px]");
  });

  it.each([
    ["loading", "Loading document"],
    ["auth", "Sign in to continue"],
    ["unavailable", "This document is unavailable"],
    ["locked", "Editing is locked"],
  ] as const)("does not resemble a new document while %s", (state, message) => {
    render(
      <DocumentStudio
        mode="new"
        state={state}
        status={<p>{message}</p>}
        title={<input aria-label="Blog title" />}
        body={<div>Body canvas</div>}
        details={<div>Cover and topics</div>}
        actions={<button type="button">Save Draft</button>}
      />,
    );

    expect(screen.getByTestId("document-studio")).toHaveAttribute(
      "data-studio-state",
      state,
    );
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Blog title" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
  });

  it("swaps the details counts for the description while the disclosure is open", () => {
    render(
      <DocumentStudio
        mode="new"
        detailsSummary={<span>3 media · 2 tags</span>}
        title={<input aria-label="Blog title" />}
        body={<div>Body canvas</div>}
        details={<div>Cover and topics</div>}
      />,
    );

    // jsdom applies no Tailwind stylesheet, so the variant classes are the
    // contract this test can verify: the counts hide while the disclosure is
    // open (group-open:hidden) and the description appears in their place
    // (hidden until group-open:inline applies).
    const details = screen
      .getByTestId("document-studio")
      .querySelector("details");
    expect(details).toHaveAttribute("open");

    const counts = screen.getByText("3 media · 2 tags");
    expect(counts.parentElement).toHaveClass("group-open:hidden");
    const description = screen.getByText(
      "Inline media and the tags readers can use to find this post.",
    );
    expect(description).toHaveClass("hidden");
    expect(description).toHaveClass("group-open:inline");

    // Closing the disclosure is what surfaces the counts again.
    details?.removeAttribute("open");
    expect(details).not.toHaveAttribute("open");
    expect(counts).toBeVisible();
  });

  it("hides the details section when detailsHidden is set", () => {
    render(
      <DocumentStudio
        mode="new"
        detailsHidden
        title={<input aria-label="Blog title" />}
        body={<div data-testid="body-canvas">Body canvas</div>}
        details={<div>Cover and topics</div>}
      />,
    );

    expect(screen.queryByText("Post details")).toBeNull();
    expect(screen.queryByText("Cover and topics")).toBeNull();
    expect(screen.getByTestId("body-canvas")).toBeVisible();
  });

  it("uses a modeLabel override in place of the mode name", () => {
    render(
      <DocumentStudio
        mode="new"
        modeLabel="Reviewing new post"
        title={<input aria-label="Blog title" />}
        body={<div>Body canvas</div>}
      />,
    );

    expect(screen.getByText("Reviewing new post")).toBeVisible();
    expect(screen.queryByText("New post")).toBeNull();
  });
});
