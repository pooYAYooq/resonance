import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CoverAuthoring from "./CoverAuthoring";
import type { MediaAsset } from "./MediaAuthoring";
import type { CoverRecoveryState } from "./reviewReadiness";

function renderCover(
  overrides: {
    cover?: MediaAsset | null;
    coverNote?: string;
    coverRecovery?: CoverRecoveryState | null;
  } = {},
) {
  const props = {
    cover: overrides.cover ?? null,
    onChooseCover: vi.fn(),
    onRemoveCover: vi.fn(),
    coverNote: overrides.coverNote,
    coverRecovery: overrides.coverRecovery ?? null,
  };
  return { ...render(<CoverAuthoring {...props} />), props };
}

describe("CoverAuthoring", () => {
  it("explains the no-cover state and offers Add cover", () => {
    renderCover();

    expect(screen.getByText("No cover selected")).toBeVisible();
    expect(
      screen.getByText("Your post will show without a cover image."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Add cover" })).toBeVisible();
  });

  it("keeps the hidden cover input out of the tab order", () => {
    renderCover();

    expect(screen.getByLabelText("Add cover image")).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("offers Replace cover and Remove cover for an existing cover", async () => {
    const user = userEvent.setup();
    const file = new File(["cover"], "cover.png", { type: "image/png" });
    const { props } = renderCover({
      cover: {
        id: "cover-1",
        kind: "cover",
        mediaType: "image",
        status: "resolved",
        url: "/cover.png",
        fileName: "cover.png",
      },
    });

    expect(screen.getByText("cover.png")).toBeVisible();
    const chooser = screen.getByLabelText("Replace cover image");
    await user.upload(chooser, file);
    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    expect(props.onChooseCover).toHaveBeenCalledWith(file);
    expect(props.onRemoveCover).toHaveBeenCalledTimes(1);
  });

  it("re-emits the same file when the cover picker is reused", async () => {
    const user = userEvent.setup();
    const file = new File(["cover"], "cover.png", { type: "image/png" });
    const { props } = renderCover();

    const chooser = screen.getByLabelText("Add cover image");
    await user.upload(chooser, file);
    await user.upload(chooser, file);

    expect(props.onChooseCover).toHaveBeenCalledTimes(2);
    expect(props.onChooseCover).toHaveBeenLastCalledWith(file);
  });

  it("explains that a selected cover uploads on save or publish", () => {
    renderCover({
      cover: {
        id: "cover-selection",
        kind: "cover",
        mediaType: "image",
        status: "choosing",
        fileName: "cover.png",
      },
      coverNote: "Uploads when you save or publish",
    });

    expect(screen.getByText("cover.png")).toBeVisible();
    expect(screen.getByText("Uploads when you save or publish")).toBeVisible();
  });

  it("uses consistent clickable action buttons with a visible hover state", () => {
    renderCover({
      cover: {
        id: "cover-1",
        kind: "cover",
        mediaType: "image",
        status: "resolved",
        fileName: "cover.png",
      },
    });

    const buttons = [
      screen.getByRole("button", { name: "Replace cover" }),
      screen.getByRole("button", { name: "Remove cover" }),
    ];

    for (const button of buttons) {
      expect(button).toHaveAttribute("data-variant", "outline");
      expect(button.className).toContain("cursor-pointer");
      expect(button.className).toContain("hover:bg-accent");
    }
  });

  it("holds Review with visible text while a recovered cover loads", () => {
    renderCover({
      cover: {
        id: "cover-1",
        kind: "cover",
        mediaType: "image",
        status: "resolved",
        statusNote: "Loading cover preview",
        fileName: "Saved cover",
      },
      coverRecovery: "resolving",
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your saved cover. Review will be available when it finishes.",
    );
    expect(screen.getByText("Saved cover")).toBeVisible();
  });

  it("shows an accessible alert and recovery actions for a failed recovered cover", async () => {
    const user = userEvent.setup();
    const file = new File(["cover"], "cover.png", { type: "image/png" });
    const { props } = renderCover({
      cover: {
        id: "cover-1",
        kind: "cover",
        mediaType: "image",
        status: "resolved",
        statusNote: "Cover preview unavailable",
        fileName: "Saved cover",
      },
      coverRecovery: "failed",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your saved cover could not be loaded. Replace it or remove it to continue to Review.",
    );

    await user.upload(screen.getByLabelText("Replace cover image"), file);
    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    expect(props.onChooseCover).toHaveBeenCalledWith(file);
    expect(props.onRemoveCover).toHaveBeenCalledTimes(1);
  });
});
