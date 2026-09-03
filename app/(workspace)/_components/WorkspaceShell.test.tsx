import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { authState, pushMock } = vi.hoisted(() => ({
  authState: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("./WorkspaceSidebar", () => ({
  WorkspaceSidebar: () => <aside>Workspace sidebar</aside>,
}));

vi.mock("./WorkspaceMobileDrawer", () => ({
  WorkspaceMobileDrawer: () => <button type="button">Open workspace menu</button>,
}));

import { WorkspaceShell } from "./WorkspaceShell";

describe("WorkspaceShell", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
    pushMock.mockReset();
  });

  it("hides workspace children while authentication resolves", () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: true });

    render(
      <WorkspaceShell>
        <p>Private workspace content</p>
      </WorkspaceShell>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Private workspace content")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects anonymous visitors with the complete return path", async () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });
    window.history.replaceState({}, "", "/dashboard/drafts?sort=recent#list");

    render(
      <WorkspaceShell>
        <p>Private workspace content</p>
      </WorkspaceShell>,
    );

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fdashboard%2Fdrafts%3Fsort%3Drecent%23list",
      ),
    );
    expect(screen.queryByText("Private workspace content")).not.toBeInTheDocument();
  });
});
