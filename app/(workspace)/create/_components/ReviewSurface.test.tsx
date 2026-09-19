import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
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
  const onBack = vi.fn();
  const onSubmit = vi.fn();
  render(
    <ReviewSurface
      mode="new"
      proposal={proposal}
      inlineImages={[]}
      pending={false}
      onBack={onBack}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onBack, onSubmit };
}

describe("ReviewSurface", () => {
  it("renders the frozen title and body", () => {
    renderSurface();

    expect(
      screen.getByRole("heading", { level: 1, name: "Review title" }),
    ).toBeVisible();
    expect(screen.getByText("Reviewed body")).toBeVisible();
  });

  it("labels the primary action for the mode", () => {
    const { unmount } = render(
      <ReviewSurface
        mode="published-edit"
        proposal={proposal}
        inlineImages={[]}
        pending={false}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Update Post" })).toBeVisible();
    unmount();
    renderSurface();
    expect(screen.getByRole("button", { name: "Publish" })).toBeVisible();
  });

  it("calls back and submit handlers", () => {
    const { onBack, onSubmit } = renderSurface();

    fireEvent.click(screen.getByRole("button", { name: "Back to editing" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables publishing while pending", () => {
    renderSurface({ pending: true });

    expect(
      screen.getByRole("button", { name: "Publishing..." }),
    ).toBeDisabled();
  });

  it("surfaces a blocker and disables publishing", () => {
    renderSurface({ blockerMessage: "Media is still uploading." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Media is still uploading.",
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });
});
