/**
 * Component tests for the shared `SectionHeading` primitive.
 *
 * Verifies the title renders as an `h2`, the optional count + label
 * appear inline, and the optional right-side action slot is honored
 * when present and absent when omitted.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";

describe("SectionHeading", () => {
  it("renders the title as an h2", () => {
    render(<SectionHeading title="Posts" />);
    const heading = screen.getByRole("heading", { level: 2, name: "Posts" });
    expect(heading).toBeInTheDocument();
  });

  it("renders the count and label inline when both are provided", () => {
    render(<SectionHeading title="Posts" count={12} countLabel="posts" />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Posts");
    expect(heading).toHaveTextContent(/12\s*posts/);
  });

  it("does not render the count when omitted", () => {
    const { container } = render(<SectionHeading title="Posts" />);
    const heading = screen.getByRole("heading", { level: 2, name: "Posts" });
    expect(heading.textContent).toBe("Posts");
    expect(container.textContent).not.toMatch(/\d+\s*posts/);
  });

  it("renders the action on the right when provided", () => {
    render(
      <SectionHeading
        title="Fresh from the community"
        action={<Link href="/blog">View All Posts</Link>}
      />,
    );
    const action = screen.getByRole("link", { name: /view all posts/i });
    expect(action).toBeInTheDocument();
  });

  it("does not render the action when omitted", () => {
    render(<SectionHeading title="Posts" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
