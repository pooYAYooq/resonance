import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pathnameState, useQueryState } = vi.hoisted(() => ({
  pathnameState: vi.fn(),
  useQueryState: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) => useQueryState(args),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { users: { getCurrentUser: "getCurrentUser" } },
}));

vi.mock("@/components/web/NotificationBell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { WorkspaceMobileDrawer } from "./WorkspaceMobileDrawer";

describe("WorkspaceMobileDrawer", () => {
  beforeEach(() => {
    pathnameState.mockReturnValue("/create");
    useQueryState.mockReturnValue({
      userId: "auth-user-1",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
    });
  });

  it("opens an accessible mobile drawer with the same destinations", async () => {
    const user = userEvent.setup();
    render(<WorkspaceMobileDrawer />);

    await user.click(screen.getByRole("button", { name: "Open workspace menu" }));

    expect(screen.getByRole("dialog", { name: "Workspace navigation" })).toBeInTheDocument();
    for (const [name, href] of [
      ["New Post", "/create"],
      ["Drafts", "/dashboard/drafts"],
      ["My Posts", "/dashboard/published"],
      ["Analytics", "/dashboard/analytics"],
      ["Discover", "/blog"],
      ["Feed", "/feed"],
      ["Saved", "/saved"],
      ["Liked", "/liked"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Open workspace account menu" }),
    );
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/u/auth-user-1",
    );
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.getByRole("menuitem", { name: "Sign Out" })).toBeInTheDocument();
  });

  it("closes after selecting a workspace destination", async () => {
    const user = userEvent.setup();
    render(<WorkspaceMobileDrawer />);

    await user.click(screen.getByRole("button", { name: "Open workspace menu" }));
    await user.click(screen.getByRole("link", { name: "Discover" }));

    expect(
      screen.queryByRole("dialog", { name: "Workspace navigation" }),
    ).not.toBeInTheDocument();
  });

  it("closes after selecting an account destination", async () => {
    const user = userEvent.setup();
    render(<WorkspaceMobileDrawer />);

    await user.click(screen.getByRole("button", { name: "Open workspace menu" }));
    await user.click(
      screen.getByRole("button", { name: "Open workspace account menu" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Profile" }));

    expect(
      screen.queryByRole("dialog", { name: "Workspace navigation" }),
    ).not.toBeInTheDocument();
  });
});
