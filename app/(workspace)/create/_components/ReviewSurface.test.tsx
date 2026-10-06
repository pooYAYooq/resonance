import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import ReviewSurface from "./ReviewSurface";

const proposal = {
  title: "Review title",
  body: JSON.stringify({
    format: "blocknote@1",
    blocks: [
      {
        type: "paragraph",
        props: {
          backgroundColor: "default",
          textColor: "default",
          textAlignment: "left",
        },
        content: [{ type: "text", text: "Reviewed body", styles: {} }],
      },
    ],
  }),
  tags: [],
};

const author = {
  userId: "user-1",
  name: "Ada Lovelace",
  avatarUrl: null,
};

function renderSurface(
  overrides: Partial<ComponentProps<typeof ReviewSurface>> = {},
) {
  render(
    <ReviewSurface
      mode="new"
      proposal={proposal}
      inlineImages={[]}
      author={author}
      {...overrides}
    />,
  );
}

describe("ReviewSurface", () => {
  it("renders the frozen title and body", () => {
    renderSurface();

    expect(
      screen.getByRole("heading", { level: 1, name: "Review title" }),
    ).toBeVisible();
    expect(screen.getByText("Reviewed body")).toBeVisible();
  });

  it("renders no action bar; actions live in the studio header", () => {
    renderSurface();

    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Back to editing" }),
    ).toBeNull();
  });

  it("renders the reviewed tags", () => {
    renderSurface({
      proposal: { ...proposal, tags: ["Technology", "Design"] },
    });

    expect(screen.getByText("Technology")).toBeVisible();
    expect(screen.getByText("Design")).toBeVisible();
  });

  it("does not render a tag row when there are no tags", () => {
    renderSurface();

    expect(screen.queryByText("Technology")).toBeNull();
  });

  it("renders the blank fallback when no cover url is given", () => {
    renderSurface();

    expect(screen.getByTestId("default-cover")).toBeVisible();
  });

  it("renders a custom cover when a cover url is given", () => {
    renderSurface({ coverUrl: "https://cdn.example/cover.png" });

    expect(screen.queryByTestId("default-cover")).toBeNull();
    const img = screen.getByAltText("Review title");
    expect(img.getAttribute("src") ?? "").toContain("cdn.example%2Fcover.png");
  });

  it("hints the cover with the reader's published sizes", () => {
    renderSurface({ coverUrl: "https://cdn.example/cover.png" });

    expect(screen.getByAltText("Review title")).toHaveAttribute(
      "sizes",
      "(max-width: 1280px) 100vw, 1216px",
    );
  });

  it("renders the published cover ratio", () => {
    renderSurface();

    expect(screen.getByTestId("default-cover").parentElement).toHaveClass(
      "aspect-[16/9]",
    );
  });

  it("holds the previewed body at the published measure", () => {
    renderSurface();

    const prose = screen.getByTestId("review-prose");
    expect(prose).toHaveClass("max-w-[700px]");
    expect(prose).toHaveClass("mx-auto");
    expect(prose).toContainElement(screen.getByText("Reviewed body"));
  });

  it("matches the published title weight", () => {
    renderSurface();

    expect(
      screen.getByRole("heading", { level: 1, name: "Review title" }),
    ).toHaveClass("font-bold");
  });

  it("renders body headings through the published token map", () => {
    renderSurface({
      proposal: {
        ...proposal,
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "heading",
              props: { level: 2 },
              content: [{ type: "text", text: "Section" }],
              children: [],
            },
          ],
        }),
      },
    });

    expect(
      screen.getByRole("heading", { level: 2, name: "Section" }),
    ).toHaveClass("text-h2");
  });

  it("surfaces the blocker alert", () => {
    renderSurface({ blockerMessage: "Some media is still uploading." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Some media is still uploading.",
    );
  });

  it("does not render an alert without a blocker", () => {
    renderSurface();

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
