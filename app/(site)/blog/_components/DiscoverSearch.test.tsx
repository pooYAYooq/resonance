import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiscoverSearch } from "./DiscoverSearch";

describe("DiscoverSearch", () => {
  it("is the primary full-width search entry point with a normalized value", () => {
    render(<DiscoverSearch query="  design  " />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
    expect(screen.getByRole("searchbox")).toHaveValue("design");
    expect(screen.getByRole("search")).toHaveAttribute("action", "/blog");
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toHaveAttribute(
      "data-slot",
      "button",
    );
  });
});
