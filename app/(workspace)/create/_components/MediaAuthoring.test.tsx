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
    onRetry: vi.fn(),
    ...overrides,
  };
  return { ...render(<MediaAuthoring {...props} />), props };
}

describe("MediaAuthoring", () => {
  it("shows explicit progress and recovery states for inline media", async () => {
    const assets: MediaAsset[] = [
      { id: "uploading", kind: "inline", status: "uploading" },
      {
        id: "failed",
        kind: "inline",
        status: "failed",
        error: "Upload failed",
      },
      { id: "expired", kind: "inline", status: "expired" },
      {
        id: "resolved",
        kind: "inline",
        status: "resolved",
        url: "/resolved.png",
      },
    ];

    const { props } = renderMedia({ inlineImages: assets });

    expect(screen.getByText("Uploading")).toBeVisible();
    expect(screen.getByText("Upload failed")).toBeVisible();
    expect(screen.getByText("This image expired")).toBeVisible();
    expect(screen.getByText("Ready")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Retry failed" }));
    expect(props.onRetry).toHaveBeenCalledWith("failed");
  });

  it("leaves native image metadata controls to BlockNote media controls", () => {
    const asset: MediaAsset = {
      id: "inline-1",
      kind: "inline",
      status: "resolved",
      url: "/inline.png",
    };
    renderMedia({ inlineImages: [asset] });

    expect(screen.queryByLabelText("Alt text")).toBeNull();
    expect(screen.queryByLabelText("Caption")).toBeNull();
  });

  it("keeps Review unavailable while required media is unresolved", () => {
    renderMedia({
      inlineImages: [{ id: "pending", kind: "inline", status: "finalizing" }],
    });

    expect(
      screen.getByRole("status", {
        name: "Review blocked until media is ready",
      }),
    ).toBeVisible();
  });

  it("makes cover add, replace, and remove actions explicit", async () => {
    const user = userEvent.setup();
    const file = new File(["cover"], "cover.png", { type: "image/png" });
    const { props } = renderMedia({
      cover: {
        id: "cover-1",
        kind: "cover",
        status: "resolved",
        url: "/cover.png",
        fileName: "cover.png",
      },
    });

    const chooser = screen.getByLabelText("Replace cover image");
    await user.upload(chooser, file);
    await user.upload(chooser, file);
    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    expect(props.onChooseCover).toHaveBeenCalledTimes(2);
    expect(props.onChooseCover).toHaveBeenLastCalledWith(file);
    expect(props.onRemoveCover).toHaveBeenCalledTimes(1);
  });
});
