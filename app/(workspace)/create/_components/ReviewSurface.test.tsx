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

function renderSurface(
  overrides: Partial<ComponentProps<typeof ReviewSurface>> = {},
) {
  render(
    <ReviewSurface
      mode="new"
      proposal={proposal}
      inlineImages={[]}
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
    const img = screen.getByAltText("Cover");
    expect(img.getAttribute("src") ?? "").toContain("cdn.example%2Fcover.png");
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
