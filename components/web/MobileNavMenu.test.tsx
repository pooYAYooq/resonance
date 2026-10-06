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
});
