import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostCover } from "./PostCover";

describe("PostCover", () => {
  it("renders the blank fallback inside the published ratio", () => {
    render(<PostCover alt="A covered post" />);

    expect(screen.getByTestId("default-cover").parentElement).toHaveClass(
      "aspect-[16/9]",
    );
  });

  it("keeps the ratio when callers add layout classes", () => {
    render(<PostCover alt="A covered post" className="mt-8 rounded-xl" />);

    const frame = screen.getByTestId("default-cover").parentElement;
    expect(frame).toHaveClass("aspect-[16/9]");
    expect(frame).toHaveClass("mt-8");
  });

  it("passes the loading hint to the image", () => {
    render(
      <PostCover
        src="https://cdn.example/cover.png"
        alt="A covered post"
        sizes="(max-width: 1100px) 100vw, 744px"
      />,
    );

    expect(screen.getByAltText("A covered post")).toHaveAttribute(
      "sizes",
      "(max-width: 1100px) 100vw, 744px",
    );
  });
});
