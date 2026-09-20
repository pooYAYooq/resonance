import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverImage } from "./CoverImage";

describe("CoverImage", () => {
  it("renders the optimized image for a custom source", () => {
    render(<CoverImage src="https://cdn.example/cover.png" alt="Post cover" />);

    const img = screen.getByAltText("Post cover");
    expect(img.getAttribute("src") ?? "").toContain("cdn.example%2Fcover.png");
    expect(screen.queryByTestId("default-cover")).toBeNull();
  });

  it("renders the blank fallback when no source is given", () => {
    render(<CoverImage src={null} alt="Post cover" />);

    const defaultCover = screen.getByTestId("default-cover");
    expect(defaultCover).toBeVisible();
    expect(screen.queryByAltText("Post cover")).toBeNull();
  });

  it("renders the blank fallback for an empty string source", () => {
    render(<CoverImage src="" alt="Post cover" />);

    expect(screen.getByTestId("default-cover")).toBeVisible();
  });
});
