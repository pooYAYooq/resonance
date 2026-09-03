import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountMenu } from "./AccountMenu";

const {
  useConvexAuthState,
  useQueryState,
  signOutUserMock,
  pushMock,
  navigateMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  useQueryState: vi.fn(),
  signOutUserMock: vi.fn(),
  pushMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: (_query: unknown, args: unknown) => useQueryState(args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { users: { getCurrentUser: "getCurrentUser" } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/web/account-actions", () => ({
  signOutUser: signOutUserMock,
}));

const currentUser = {
  _id: "users-1",
  _creationTime: 0,
  userId: "auth-user-1",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
  bio: "",
  createdAt: 0,
};

describe("AccountMenu", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryState.mockReturnValue(currentUser);
    signOutUserMock.mockClear();
    pushMock.mockClear();
    navigateMock.mockClear();
  });

  afterEach(() => vi.clearAllMocks());

  it("renders the shared account destinations", async () => {
    const user = userEvent.setup();
    render(<AccountMenu presentation="navbar" />);

    await user.click(screen.getByRole("button", { name: /open user menu/i }));

    expect(screen.getByRole("menuitem", { name: /profile/i })).toHaveAttribute(
      "href",
      "/u/auth-user-1",
    );
    expect(screen.getByRole("menuitem", { name: "Saved" })).toHaveAttribute(
      "href",
      "/saved",
    );
    expect(screen.getByRole("menuitem", { name: "Liked" })).toHaveAttribute(
      "href",
      "/liked",
    );
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("uses workspace presentation and notifies the drawer on actions", async () => {
    const user = userEvent.setup();
    render(<AccountMenu presentation="workspace" onNavigate={navigateMock} />);

    expect(
      screen.getByRole("button", { name: /open workspace account menu/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /open workspace account menu/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /profile/i }));

    expect(navigateMock).toHaveBeenCalled();
  });
});
