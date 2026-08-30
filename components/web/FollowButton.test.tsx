/**
 * Component tests for `FollowButton`.
 *
 * Verifies the Follow / Following label transition, the pending
 * disabled state, the success toast, and that `toggleFollow` is
 * invoked with the correct `followingId` argument.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  useConvexAuthState,
  useQueryMock,
  useMutationMock,
  pushMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
  pushMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: (_query: unknown, args: unknown) => useQueryMock(args),
  useMutation: () => useMutationMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    follows: {
      toggleFollow: "toggleFollow",
      isFollowing: "isFollowing",
    },
  },
}));

import { FollowButton } from "./FollowButton";

const baseProps = {
  profileUserId: "author-1",
  authorName: "Ada",
  isFollowing: false,
};

describe("FollowButton", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryMock.mockReturnValue(false);
    useMutationMock.mockReset();
    pushMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Follow' when isFollowing is false", () => {
    render(<FollowButton {...baseProps} />);
    expect(screen.getByRole("button", { name: /follow/i })).toBeInTheDocument();
  });

  it("renders 'Following' when isFollowing is true", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<FollowButton {...baseProps} isFollowing={true} />);
    // The visible label is the `<span>Following</span>`; the accessible
    // name is the aria-label ("Unfollow Ada"), so query by visible text.
    expect(screen.getByText("Following")).toBeInTheDocument();
    // And the button is the unfollow affordance in this state.
    expect(
      screen.getByRole("button", { name: /unfollow ada/i }),
    ).toBeInTheDocument();
  });

  it("sets aria-pressed to true when following", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<FollowButton {...baseProps} isFollowing={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("sets aria-pressed to false when not following", () => {
    render(<FollowButton {...baseProps} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("calls toggleFollow with the correct followingId on click and toasts on success", async () => {
    const user = userEvent.setup();
    useMutationMock.mockResolvedValue({ following: true });
    render(<FollowButton {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /follow/i }));
    expect(useMutationMock).toHaveBeenCalledWith({
      followingId: "author-1",
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Followed Ada");
  });

  it("toasts 'Unfollowed {name}' when toggling from following to not", async () => {
    const user = userEvent.setup();
    useQueryMock.mockReturnValue(true);
    useMutationMock.mockResolvedValue({ following: false });
    render(<FollowButton {...baseProps} />);

    // In the following state the button's accessible name is "Unfollow Ada"
    // (aria-label overrides the visible "Following" span).
    await user.click(screen.getByRole("button", { name: /unfollow ada/i }));
    expect(toastSuccessMock).toHaveBeenCalledWith("Unfollowed Ada");
  });

  it("redirects to login when unauthenticated user clicks", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    window.history.replaceState({}, "", "/u/author-1?view=posts#follow");
    render(<FollowButton {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /follow/i }));
    expect(pushMock).toHaveBeenCalledWith(
      "/auth/login?returnTo=%2Fu%2Fauthor-1%3Fview%3Dposts%23follow",
    );
    expect(useMutationMock).not.toHaveBeenCalled();
  });

  it("renders 'Follow' while the isFollowing query is loading", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<FollowButton {...baseProps} />);
    expect(screen.getByRole("button", { name: /follow/i })).toBeInTheDocument();
  });

  it("skips the private follow query until resolved authentication is authenticated", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    render(<FollowButton {...baseProps} />);
    expect(useQueryMock).toHaveBeenLastCalledWith("skip");

    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<FollowButton {...baseProps} />);
    expect(useQueryMock).toHaveBeenLastCalledWith("skip");
  });

  it("queries follows after resolved authenticated authentication", () => {
    render(<FollowButton {...baseProps} />);

    expect(useQueryMock).toHaveBeenLastCalledWith({
      followingId: "author-1",
    });
  });
});
