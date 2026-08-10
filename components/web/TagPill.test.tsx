import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagPill } from "./TagPill";

describe("TagPill", () => {
  it("renders a linked tag with URL encoding", () => {
    render(<TagPill tag="Technology" />);
    expect(screen.getByRole("link", { name: "Technology" })).toHaveAttribute(
      "href",
      "/blog?tag=Technology",
    );

    render(<TagPill tag="Design & UX" />);
    expect(screen.getByRole("link", { name: "Design & UX" })).toHaveAttribute(
      "href",
      "/blog?tag=Design%20%26%20UX",
    );
  });
});
