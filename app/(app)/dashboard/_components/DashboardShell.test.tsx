import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { authState, pathnameState, pushMock } = vi.hoisted(() => ({
  authState: vi.fn(),
  pathnameState: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState(),
  useRouter: () => ({ push: pushMock }),
}));

import { DashboardShell } from "./DashboardShell";

describe("DashboardShell", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
    pathnameState.mockReturnValue("/dashboard");
    pushMock.mockReset();
  });

  it("shows a loading state while authentication is resolving", () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: true });

    render(
      <DashboardShell>
        <p>Private dashboard content</p>
      </DashboardShell>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByText("Private dashboard content"),
    ).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users without rendering child data", async () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });
    window.history.replaceState({}, "", "/dashboard/drafts?sort=recent#list");

    render(
      <DashboardShell>
        <p>Private dashboard content</p>
      </DashboardShell>,
    );

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fdashboard%2Fdrafts%3Fsort%3Drecent%23list",
      ),
    );
    expect(
      screen.queryByText("Private dashboard content"),
    ).not.toBeInTheDocument();
  });

  it("renders workspace links and the active section for authenticated users", () => {
    pathnameState.mockReturnValue("/dashboard/drafts");

    render(
      <DashboardShell>
        <p>Private dashboard content</p>
      </DashboardShell>,
    );

    expect(screen.getByRole("heading", { name: "Drafts" })).toBeInTheDocument();
    for (const name of ["Overview", "Drafts", "Published"]) {
      expect(screen.getAllByRole("link", { name })).not.toHaveLength(0);
    }
    expect(
      screen.queryByRole("link", { name: "Saved" }),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Drafts" })
        .some((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
    expect(screen.getByText("Private dashboard content")).toBeInTheDocument();
  });
});
