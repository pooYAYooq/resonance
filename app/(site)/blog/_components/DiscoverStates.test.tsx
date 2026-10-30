import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiscoverResultsSkeleton } from "./DiscoverStates";

describe("DiscoverStates", () => {
  it("provides a results loading boundary", () => {
    render(<DiscoverResultsSkeleton />);
    expect(screen.getByTestId("discover-results-skeleton")).toBeInTheDocument();
  });
});
