import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./_components/LikedSection", () => ({
  LikedSection: () => <div>Liked section</div>,
}));

import LikedRoute from "./page";

describe("Liked route", () => {
  it("renders a page-level heading for liked posts", () => {
    render(<LikedRoute />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Liked posts" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Liked section")).toBeInTheDocument();
  });
});
