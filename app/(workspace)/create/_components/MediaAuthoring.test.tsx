import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MediaAuthoring, {
  type MediaAsset,
  type MediaAuthoringProps,
} from "./MediaAuthoring";

function renderMedia(overrides: Partial<MediaAuthoringProps> = {}) {
  const props: MediaAuthoringProps = {
    inlineImages: [],
    cover: null,
    onChooseCover: vi.fn(),
    onRemoveCover: vi.fn(),
    onReplaceMedia: vi.fn(),
    ...overrides,
  };
  return { ...render(<MediaAuthoring {...props} />), props };
}

describe("MediaAuthoring", () => {
  it("labels every inline lifecycle state", () => {
    const assets: MediaAsset[] = [
      { id: "choosing", kind: "inline", status: "choosing" },
      { id: "uploading", kind: "inline", status: "uploading" },
      { id: "finalizing", kind: "inline", status: "finalizing" },
      { id: "resolved", kind: "inline", status: "resolved", url: "/r.png" },
      {
        id: "failed",
        kind: "inline",
        status: "failed",
        error: "Upload failed",
      },
    ];

    renderMedia({ inlineImages: assets });

    expect(screen.getByText("Selected")).toBeVisible();
    expect(screen.getByText("Uploading...")).toBeVisible();
    expect(screen.getByText("Finishing upload...")).toBeVisible();
    expect(screen.getByText("Ready to publish")).toBeVisible();
    expect(screen.getByText("Upload failed")).toBeVisible();
  });

  it("labels inline rows and leaves resolved-row editing to BlockNote", () => {
    renderMedia({
      inlineImages: [
        { id: "inline-1", kind: "inline", status: "resolved", url: "/i.png" },
      ],
    });

    expect(screen.getByText("Inline")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Replace" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByLabelText("Alt text")).toBeNull();
    expect(screen.queryByLabelText("Caption")).toBeNull();
  });

  it("offers Replace and Remove for failed media", async () => {
    const { props } = renderMedia({
      inlineImages: [
        {
          id: "failed",
          kind: "inline",
          status: "failed",
          error: "Upload failed",
        },
      ],
      onRemoveInline: vi.fn(),
    });

    await userEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(props.onReplaceMedia).toHaveBeenCalledWith("failed");
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(props.onRemoveInline).toHaveBeenCalledWith("failed");
  });

  it.each(["audio", "video"] as const)(
    "renders a %s glyph instead of a broken image",
    (mediaType) => {
      renderMedia({
        inlineImages: [
          { id: mediaType, kind: "inline", status: "resolved", mediaType },
        ],
      });

      expect(screen.getByTestId("media-placeholder")).toBeVisible();
      expect(screen.queryByTestId("media-preview")).toBeNull();
    },
  );

  it.each([
    ["audio", "Audio"],
    ["video", "Video"],
    ["image", "Image"],
  ] as const)("announces the %s media type", (mediaType, label) => {
    renderMedia({
      inlineImages: [
        { id: mediaType, kind: "inline", status: "resolved", mediaType },
      ],
    });

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("keeps Review unavailable while required media is unresolved", () => {
    renderMedia({
      inlineImages: [{ id: "p", kind: "inline", status: "finalizing" }],
    });

    expect(
      screen.getByRole("status", {
        name: "Review blocked until media is ready",
      }),
    ).toBeVisible();
  });

  it("explains the no-cover state and offers Add cover", () => {
    renderMedia();

    expect(
      screen.getByText(
        "No cover selected. Your post will show without a cover image.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Add cover" })).toBeVisible();
  });

  it("keeps the hidden cover input out of the tab order", () => {
    renderMedia();

    expect(screen.getByLabelText("Add cover image")).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("offers Replace cover and Remove cover for an existing cover", async () => {
    const user = userEvent.setup();
    const file = new File(["cover"], "cover.png", { type: "image/png" });
    const { props } = renderMedia({
      cover: {
        id: "cover-1",
        kind: "cover",
        mediaType: "image",
        status: "resolved",
        url: "/cover.png",
        fileName: "cover.png",
      },
    });

    expect(screen.getByText("Cover")).toBeVisible();
    const chooser = screen.getByLabelText("Replace cover image");
    await user.upload(chooser, file);
    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    expect(props.onChooseCover).toHaveBeenCalledWith(file);
    expect(props.onRemoveCover).toHaveBeenCalledTimes(1);
  });

  it("re-emits the same file when the cover picker is reused", async () => {
    const user = userEvent.setup();
    const file = new File(["cover"], "cover.png", { type: "image/png" });
    const { props } = renderMedia();

    const chooser = screen.getByLabelText("Add cover image");
    await user.upload(chooser, file);
    await user.upload(chooser, file);

    expect(props.onChooseCover).toHaveBeenCalledTimes(2);
    expect(props.onChooseCover).toHaveBeenLastCalledWith(file);
  });

  it("explains that a selected cover uploads on save or publish", () => {
    renderMedia({
      cover: {
        id: "cover-selection",
        kind: "cover",
        mediaType: "image",
        status: "choosing",
        fileName: "cover.png",
      },
      coverNote: "Uploads when you save or publish",
    });

    expect(screen.getByText("Selected")).toBeVisible();
    expect(screen.getByText("Uploads when you save or publish")).toBeVisible();
  });

  it("uses consistent clickable action buttons with a visible hover state", () => {
    renderMedia({
      inlineImages: [{ id: "failed", kind: "inline", status: "failed" }],
      cover: {
        id: "cover-1",
        kind: "cover",
        mediaType: "image",
        status: "resolved",
        fileName: "cover.png",
      },
    });

    const buttons = [
      screen.getByRole("button", { name: "Replace" }),
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
    renderMedia({
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
    expect(screen.getByText("Loading cover preview")).toBeVisible();
  });

  it("shows an accessible alert and recovery actions for a failed recovered cover", async () => {
    const user = userEvent.setup();
    const file = new File(["cover"], "cover.png", { type: "image/png" });
    const { props } = renderMedia({
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
