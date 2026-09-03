import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./_components/AnalyticsSummary", () => ({
  AnalyticsSummary: () => <h2>Analytics</h2>,
}));

import AnalyticsRoute from "./page";

describe("Dashboard analytics route", () => {
  it("renders the analytics summary boundary", () => {
    render(<AnalyticsRoute />);

    expect(
      screen.getByRole("heading", { name: "Analytics" }),
    ).toBeInTheDocument();
  });
});
