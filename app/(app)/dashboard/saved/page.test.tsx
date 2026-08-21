import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../_components/SavedSection", () => ({
  SavedSection: () => <h2>Saved</h2>,
}));

import DashboardSavedRoute from "./page";

describe("Dashboard saved route", () => {
  it("renders the Saved section boundary", () => {
    render(<DashboardSavedRoute />);

    expect(screen.getByRole("heading", { name: "Saved" })).toBeInTheDocument();
  });
});
