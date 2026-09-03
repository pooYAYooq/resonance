import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../_components/PublishedSection", () => ({
  PublishedSection: () => <h2>Published</h2>,
}));

import DashboardPublishedRoute from "./page";

describe("Dashboard published route", () => {
  it("renders the My Posts section boundary", () => {
    render(<DashboardPublishedRoute />);

    expect(
      screen.getByRole("heading", { name: "My Posts" }),
    ).toBeInTheDocument();
  });
});
