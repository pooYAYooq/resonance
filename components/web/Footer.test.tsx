import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./FooterCTA", () => ({
  FooterCTA: () => <div>Footer CTA</div>,
}));

import { Footer } from "./Footer";

describe("Footer", () => {
  it("keeps the legacy workspace footer and its CTA for callers without a variant", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText("Footer CTA")).toBeInTheDocument();
  });

  it("renders the fuller marketing footer without an auth CTA card", () => {
    render(<Footer variant="marketing" />);

    for (const socialLink of ["GitHub", "Twitter", "LinkedIn"]) {
      expect(screen.queryByRole("link", { name: socialLink })).toBeNull();
    }

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("link", { name: "Create Post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(screen.queryByText("Footer CTA")).toBeNull();
    expect(screen.queryByText("Join the Community")).toBeNull();
  });

  it("renders a compact footer without marketing navigation", () => {
    render(<Footer variant="compact" />);

    expect(screen.queryByRole("link", { name: "Home" })).toBeNull();
    expect(screen.queryByText("Explore")).toBeNull();
    expect(screen.queryByText("Footer CTA")).toBeNull();
    expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
  });
});
