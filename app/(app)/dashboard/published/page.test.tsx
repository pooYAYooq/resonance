import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPublishedRoute from "./page";

describe("Dashboard published route", () => {
  it("renders the Published section boundary", () => {
    render(<DashboardPublishedRoute />);

    expect(screen.getByRole("heading", { name: "Published" })).toBeInTheDocument();
  });
});
