import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { pathnameState, useQueryState } = vi.hoisted(() => ({
  pathnameState: vi.fn(),
  useQueryState: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: unknown) => useQueryState(query, args),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: { getCurrentUser: "getCurrentUser" },
    notifications: { getUnreadCount: "getUnreadCount" },
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { WorkspaceSidebar } from "./WorkspaceSidebar";

describe("WorkspaceSidebar", () => {
  beforeEach(() => {
    pathnameState.mockReturnValue("/dashboard/drafts");
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount"
        ? 0
        : {
            userId: "auth-user-1",
            displayName: "Ada Lovelace",
            email: "ada@example.com",
            avatarUrl: null,
          },
    );
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

    expect(
      screen.queryByRole("link", { name: "Overview" }),
    ).not.toBeInTheDocument();
  });

  it("marks the current route as active and renders account utilities", () => {
    render(<WorkspaceSidebar />);

    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/u/auth-user-1",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(
      screen.getByRole("button", { name: "Sign Out" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "System" })).toBeInTheDocument();
  });
});
