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
vi.mock("./SavedPreview", () => ({
  SavedPreview: () => <div>Saved Posts</div>,
}));

import { DashboardOverview } from "./DashboardOverview";

describe("DashboardOverview", () => {
  it("renders all independent previews and their workspace links", () => {
    render(<DashboardOverview />);

    expect(
      screen.getByRole("heading", { name: "Your writing workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Continue Writing")).toBeInTheDocument();
    expect(screen.getByText("Published Posts")).toBeInTheDocument();
    expect(screen.getByText("Saved Posts")).toBeInTheDocument();
  });
});
