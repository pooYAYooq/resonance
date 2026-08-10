import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlogFilter } from "./BlogFilter";

describe("BlogFilter", () => {
  it("shows the active tag and clear link", () => {
    render(<BlogFilter tag="Technology" />);
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /clear filter/i })).toHaveAttribute(
      "href",
      "/blog",
    );
  });
});
