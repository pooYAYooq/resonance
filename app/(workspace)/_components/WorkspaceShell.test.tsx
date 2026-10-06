import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

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

vi.mock("@/components/web/Navbar", () => ({
  Navbar: () => <nav>Site navbar</nav>,
}));

import { WorkspaceShell } from "./WorkspaceShell";
import DocumentStudio from "../create/_components/DocumentStudio";

describe("WorkspaceShell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("supplies the actual mobile navbar height to editing actions and tracks resizes", () => {
    let height = 92;
    let resize: (() => void) | undefined;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return new DOMRect(0, 0, 0, this.querySelector("nav") ? height : 0);
      },
    );
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resize = () => callback([], this);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    render(
      <WorkspaceShell>
        <DocumentStudio
          mode="new"
          body={<p>Live editor</p>}
          actions={<button>Review</button>}
        />
      </WorkspaceShell>,
    );
    const toolbar = screen
      .getByRole("button", { name: "Review" })
      .closest("header");
    const shell = toolbar?.closest('[style*="--workspace-navbar-height"]');
    expect(shell).toHaveStyle({ "--workspace-navbar-height": "92px" });
    height = 128;
    act(() => {
      resize?.();
    });
    expect(shell).toHaveStyle({ "--workspace-navbar-height": "128px" });
  });

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
    expect(
      screen.queryByText("Private workspace content"),
    ).not.toBeInTheDocument();
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
    expect(
      screen.queryByText("Private workspace content"),
    ).not.toBeInTheDocument();
  });
});
