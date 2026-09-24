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

  it("uses consistent clickable action buttons with a visible hover state", () => {
    renderMedia({
      inlineImages: [{ id: "failed", kind: "inline", status: "failed" }],
    });

    const button = screen.getByRole("button", { name: "Replace" });
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button.className).toContain("cursor-pointer");
    expect(button.className).toContain("hover:bg-accent");
  });
});
