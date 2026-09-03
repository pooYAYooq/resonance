import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./_components/SavedSection", () => ({
  SavedSection: () => <div>Saved section</div>,
}));

import SavedRoute from "./page";

describe("Saved route", () => {
  it("renders a page-level heading for saved posts", () => {
    render(<SavedRoute />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Saved posts" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Saved section")).toBeInTheDocument();
  });
});
