import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostCardCover } from "./PostCardCover";

describe("PostCardCover", () => {
  it("defaults to the 3:2 frame", () => {
    render(
      <PostCardCover>
        <span>cover</span>
      </PostCardCover>,
    );

    expect(screen.getByTestId("post-card-cover")).toHaveClass("aspect-[3/2]");
    expect(screen.getByText("cover")).toBeInTheDocument();
  });

  it("renders the 16:9 frame", () => {
    render(
      <PostCardCover ratio="16/9">
        <span>cover</span>
      </PostCardCover>,
    );

    expect(screen.getByTestId("post-card-cover")).toHaveClass("aspect-video");
  });

  it("renders a fill frame with no fixed aspect ratio", () => {
    render(
      <PostCardCover ratio="fill">
        <span>cover</span>
      </PostCardCover>,
    );

    const frame = screen.getByTestId("post-card-cover");
    expect(frame).toHaveClass("h-full");
    expect(frame).not.toHaveClass("aspect-[3/2]");
    expect(frame).not.toHaveClass("aspect-video");
  });

  it("merges layout classes and a custom test id", () => {
    render(
      <PostCardCover
        className="rounded-t-xl sm:aspect-auto sm:h-full"
        testId="author-card-cover"
      >
        <span>cover</span>
      </PostCardCover>,
    );

    const frame = screen.getByTestId("author-card-cover");
    expect(frame).toHaveClass("rounded-t-xl");
    expect(frame).toHaveClass("sm:aspect-auto");
    expect(frame).toHaveClass("sm:h-full");
    expect(frame).toHaveClass("aspect-[3/2]");
  });

  it("lets a caller override the ratio at the same breakpoint", () => {
    render(
      <PostCardCover className="aspect-square">
        <span>cover</span>
      </PostCardCover>,
    );

    const frame = screen.getByTestId("post-card-cover");
    expect(frame).toHaveClass("aspect-square");
    expect(frame).not.toHaveClass("aspect-[3/2]");
  });

  it("clips the cover and provides the neutral fallback surface", () => {
    render(
      <PostCardCover>
        <span>cover</span>
      </PostCardCover>,
    );

    expect(screen.getByTestId("post-card-cover")).toHaveClass(
      "relative",
      "overflow-hidden",
      "bg-muted",
    );
  });
});
