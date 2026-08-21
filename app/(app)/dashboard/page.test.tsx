import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardOverviewRoute from "./page";

describe("Dashboard overview route", () => {
  it("renders the Overview section instead of redirecting to Drafts", () => {
    render(<DashboardOverviewRoute />);

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByText("Drafts")).not.toBeInTheDocument();
  });
});
