/**
 * Component tests for the navbar.
 *
 * Verifies the unauthenticated state shows Sign up + Login links, and
 * the authenticated state shows the avatar dropdown trigger.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  useQuery: (_query: unknown, args: unknown) => useQueryState(args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: {
      getCurrentUser: "getCurrentUser",
    },
    feed: {
      getFeed: "getFeed",
    },
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: (...args: unknown[]) => signOutMock(...args),
  },
}));

vi.mock("./NotificationBell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
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
    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute(
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
    expect(
      screen.queryByRole("button", { name: /open navigation menu/i }),
    ).toBeNull();
    expect(useQueryState).toHaveBeenLastCalledWith("skip");
  });

  it("skips the private current-user query when authentication is anonymous", () => {
    render(<Navbar />);

    expect(useQueryState).toHaveBeenLastCalledWith("skip");
  });

  it("shows the avatar dropdown trigger when authenticated with a current user", () => {
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<Navbar />);

    expect(useQueryState).toHaveBeenLastCalledWith({});

    expect(
      screen.getByRole("button", { name: /open user menu/i }),
    ).toBeInTheDocument();
  });

  it("shows the Feed navigation link only in the authenticated branch", () => {
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute(
      "href",
      "/feed",
    );
  });

  it("links the authenticated logo to /dashboard", () => {
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "RESONANCE" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
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

  it("opens the menu and shows profile, Saved, Liked, settings, and sign out items", async () => {
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
    expect(screen.getByRole("menuitem", { name: "Saved" })).toHaveAttribute(
      "href",
      "/saved",
    );
    expect(screen.getByRole("menuitem", { name: "Liked" })).toHaveAttribute(
      "href",
      "/liked",
    );
    expect(screen.getByRole("menuitem", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(
      screen.getByRole("menuitem", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("does not restore focus to the avatar when the menu is dismissed", async () => {
    const user = userEvent.setup();
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(
      <>
        <Navbar />
        <button type="button">Page content</button>
      </>,
    );

    const trigger = screen.getByRole("button", { name: /open user menu/i });
    await user.click(trigger);
    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(trigger).not.toHaveFocus();
  });

  it("restores focus to the avatar when the menu is dismissed with Escape", async () => {
    const user = userEvent.setup();
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<Navbar />);

    const trigger = screen.getByRole("button", { name: /open user menu/i });
    await user.click(trigger);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("shows Discover, Feed, New Post, and notifications when authenticated", () => {
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();
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
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));

    expect(signOutMock).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Logged out successfully!");
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
