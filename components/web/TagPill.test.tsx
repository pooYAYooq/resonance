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

  it("links tags that are no longer in the selector", () => {
    render(<TagPill tag="RemovedTag" />);
    expect(screen.getByRole("link", { name: "RemovedTag" })).toHaveAttribute(
      "href",
      "/blog?tag=RemovedTag",
    );
  });

  it("allows roomier reader padding without changing the default tag sizing", () => {
    const { rerender } = render(<TagPill tag="Culture" className="py-1" />);
    const tag = screen.getByRole("link", { name: "Culture" });
    expect(tag).toHaveClass("py-1", "text-xs");
    expect(tag).not.toHaveClass("py-0.5");

    rerender(<TagPill tag="Culture" />);
    expect(tag).toHaveClass("py-0.5");
    expect(tag).not.toHaveClass("py-1");
  });

  it("exposes a visible keyboard focus style without replacing the topic name", () => {
    render(<TagPill tag="Culture" />);
    expect(screen.getByRole("link", { name: "Culture" })).toHaveClass(
      "focus-visible:outline-2",
      "focus-visible:outline-ring",
      "focus-visible:outline-offset-2",
    );
  });
});
