import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./AnalyticsSummary", () => ({
  AnalyticsSummary: () => <div>Analytics</div>,
}));
vi.mock("./DraftsPreview", () => ({
  DraftsPreview: () => <div>Continue Writing</div>,
}));
vi.mock("./PublishedPreview", () => ({
  PublishedPreview: () => <div>Published Posts</div>,
}));
import { DashboardOverview } from "./DashboardOverview";

describe("DashboardOverview", () => {
  it("renders the remaining deferred previews without Saved", () => {
    render(<DashboardOverview />);

    expect(
      screen.getByRole("heading", { name: "Your writing workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Continue Writing")).toBeInTheDocument();
    expect(screen.getByText("Published Posts")).toBeInTheDocument();
    expect(screen.queryByText("Saved Posts")).toBeNull();
  });
});
