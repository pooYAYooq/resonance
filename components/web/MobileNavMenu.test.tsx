import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

import { MobileNavMenu } from "./MobileNavMenu";

describe("MobileNavMenu", () => {
  beforeEach(() => {
    pathnameState.mockReturnValue("/create");
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount" ? 0 : undefined,
    );
  });

  it("exposes New Post, Discover, and Feed links for authenticated users", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute(
      "href",
      "/feed",
    );
  });

  it("exposes Home, Discover, Log In, and Sign Up for anonymous users", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu isAuthenticated={false} />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(screen.queryByRole("link", { name: "New Post" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Feed" })).toBeNull();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
    expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute(
      "href",
      "/auth/sign-up",
    );
  });

  it("opens an accessible drawer with every destination and account link", async () => {
    const user = userEvent.setup();
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

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Navigation" }),
    ).toBeInTheDocument();
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
    expect(
      screen.queryByRole("link", { name: "Overview" }),
    ).not.toBeInTheDocument();

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
  });

  it("closes after selecting a workspace destination", async () => {
    const user = userEvent.setup();
    render(<MobileNavMenu isAuthenticated />);

    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    await user.click(screen.getByRole("link", { name: "Discover" }));

    expect(
      screen.queryByRole("dialog", { name: "Navigation" }),
    ).not.toBeInTheDocument();
  });

  it("closes after selecting an account destination", async () => {
    const user = userEvent.setup();
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

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    await user.click(screen.getByRole("link", { name: "Profile" }));

    expect(
      screen.queryByRole("dialog", { name: "Navigation" }),
    ).not.toBeInTheDocument();
  });
});
