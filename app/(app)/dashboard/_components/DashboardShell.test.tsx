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
    expect(screen.queryByText("Private dashboard content")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users without rendering child data", async () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });

    render(
      <DashboardShell>
        <p>Private dashboard content</p>
      </DashboardShell>,
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/auth/login"));
    expect(screen.queryByText("Private dashboard content")).not.toBeInTheDocument();
  });

  it("renders workspace links and the active section for authenticated users", () => {
    pathnameState.mockReturnValue("/dashboard/drafts");

    render(
      <DashboardShell>
        <p>Private dashboard content</p>
      </DashboardShell>,
    );

    expect(screen.getByRole("heading", { name: "Drafts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
      "href",
      "/create",
    );
    for (const name of ["Overview", "Drafts", "Published", "Saved"]) {
      expect(screen.getAllByRole("link", { name })).not.toHaveLength(0);
    }
    expect(
      screen.getAllByRole("link", { name: "Drafts" }).some(
        (link) => link.getAttribute("aria-current") === "page",
      ),
    ).toBe(true);
    expect(screen.getByText("Private dashboard content")).toBeInTheDocument();
  });
});
