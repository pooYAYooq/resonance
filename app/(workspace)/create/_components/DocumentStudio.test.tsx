import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getAllByText("Post details")).toHaveLength(1);
    expect(studio.querySelector("details")).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Review" })).toBeVisible();
    expect(studio.className).not.toContain("rounded-lg");
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
    expect(studio.querySelector("details")).toBeInTheDocument();
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
});
