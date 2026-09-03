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

import { WorkspaceSidebar } from "./WorkspaceSidebar";

describe("WorkspaceSidebar", () => {
  beforeEach(() => {
    pathnameState.mockReturnValue("/dashboard/drafts");
    useQueryState.mockReturnValue({
      userId: "auth-user-1",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
    });
  });

  it("renders approved writing and reading links without an Overview link", () => {
    render(<WorkspaceSidebar />);

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

    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
  });

  it("marks the current route as active and renders workspace utilities", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSidebar />);

    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
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
  });
});
