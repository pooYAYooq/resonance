import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostTags } from "./PostTags";

describe("PostTags", () => {
  it("renders linked tags", () => {
    render(<PostTags tags={["Technology", "Design"]} />);

    expect(screen.getByRole("link", { name: "Technology" })).toHaveAttribute(
      "href",
      "/blog?tag=Technology",
    );
    expect(screen.getByRole("link", { name: "Design" })).toBeInTheDocument();
  });

  it("can hide non-canonical tags", () => {
    render(<PostTags tags={["Technology", "NotATag"]} filterCanonical />);

    expect(
      screen.getByRole("link", { name: "Technology" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("NotATag")).toBeNull();
  });

  it("renders nothing without tags", () => {
    const { container } = render(<PostTags tags={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
