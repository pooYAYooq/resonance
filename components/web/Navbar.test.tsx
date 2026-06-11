/**
 * Component tests for the navbar.
 *
 * Verifies the unauthenticated state shows Sign up + Login links, and
 * the authenticated state shows the avatar dropdown trigger.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "./Navbar";

const {
  useConvexAuthState,
  useQueryState,
  signOutMock,
  toastSuccessMock,
  pushMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  useQueryState: vi.fn(),
  signOutMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  pushMock: vi.fn(),
}));

let currentQueryValue: unknown = undefined;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: vi.fn(),
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: () => useQueryState(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: {
      getCurrentUser: "getCurrentUser",
    },
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: (...args: unknown[]) => signOutMock(...args),
  },
}));

const currentUser = {
  _id: "users-1",
  _creationTime: 0,
  userId: "auth-user-1",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: "https://example.com/ada.png",
  bio: "",
  createdAt: 0,
};

describe("Navbar", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    useQueryState.mockImplementation(() => currentQueryValue);
    currentQueryValue = undefined;
    signOutMock.mockClear();
    toastSuccessMock.mockClear();
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows Sign up and Login links when not authenticated", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/auth/sign-up",
    );
    expect(screen.getByRole("link", { name: /login/i })).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });

  it("does not show auth buttons while auth is loading", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    render(<Navbar />);

    expect(screen.queryByRole("link", { name: /sign up/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /login/i })).toBeNull();
  });

  it("shows the avatar dropdown trigger when authenticated with a current user", () => {
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<Navbar />);

    expect(
      screen.getByRole("button", { name: /open user menu/i }),
    ).toBeInTheDocument();
  });

  it("renders the avatar with the current user's initials in the trigger", () => {
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<Navbar />);

    // jsdom does not load network images, so the avatar renders its
    // fallback (initials) instead of an <img>. The trigger button still
    // owns the avatar by aria-label.
    const trigger = screen.getByRole("button", { name: /open user menu/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("AD");
  });

  it("opens the menu and shows profile, settings, and logout items", async () => {
    const user = userEvent.setup();
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: /open user menu/i }));

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /profile/i })).toHaveAttribute(
      "href",
      "/u/auth-user-1",
    );
    expect(screen.getByRole("menuitem", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.getByRole("menuitem", { name: /logout/i })).toBeInTheDocument();
  });

  it("calls authClient.signOut and shows a toast on logout click", async () => {
    const user = userEvent.setup();
    signOutMock.mockImplementation(({ fetchOptions }) => {
      fetchOptions.onSuccess();
    });
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: /open user menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /logout/i }));

    expect(signOutMock).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Logged out successfully!");
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
