import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./_components/DashboardOverview", () => ({
  DashboardOverview: () => <h2>Overview</h2>,
}));

import DashboardOverviewRoute from "./page";

describe("Dashboard overview route", () => {
  it("renders the Overview section instead of redirecting to Drafts", () => {
    render(<DashboardOverviewRoute />);

    expect(
      screen.getByRole("heading", { name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Drafts")).not.toBeInTheDocument();
  });
});
