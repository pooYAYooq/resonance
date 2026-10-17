import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./DraftsPreview", () => ({
  DraftsPreview: () => <div>Continue Writing</div>,
}));
vi.mock("./PublishedPreview", () => ({
  PublishedPreview: () => <div>Published Posts</div>,
}));
// The welcome popup reads Convex auth and query state; it is not the subject of
// this test and there is no Convex provider here.
vi.mock("@/components/web/WelcomeDialog", () => ({
  WelcomeDialog: () => null,
}));
import { DashboardOverview } from "./DashboardOverview";

describe("DashboardOverview", () => {
  it("renders the remaining deferred previews without Analytics or Saved", () => {
    render(<DashboardOverview />);

    expect(
      screen.getByRole("heading", { name: "Your writing workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Continue Writing")).toBeInTheDocument();
    expect(screen.getByText("Published Posts")).toBeInTheDocument();
    expect(screen.queryByText("Analytics")).toBeNull();
    expect(screen.queryByText("Saved Posts")).toBeNull();
  });
});
