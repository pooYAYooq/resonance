import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../_components/DraftsSection", () => ({
  DraftsSection: () => <h2>Drafts</h2>,
}));

import DashboardDraftsRoute from "./page";

describe("Dashboard drafts route", () => {
  it("renders the Drafts section boundary", () => {
    render(<DashboardDraftsRoute />);

    expect(screen.getByRole("heading", { name: "Drafts" })).toBeInTheDocument();
  });
});
