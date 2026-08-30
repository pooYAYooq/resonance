import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./FooterCTA", () => ({
  FooterCTA: () => <div>Footer CTA</div>,
}));

import { Footer } from "./Footer";

describe("Footer", () => {
  it("omits placeholder social links while keeping real navigation", () => {
    render(<Footer />);

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
  });
});
