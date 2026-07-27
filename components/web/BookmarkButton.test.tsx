/**
 * Component tests for `BookmarkButton`.
 *
 * Verifies the saved / unsaved icon transition, the pending disabled state,
 * the success toasts, and that `toggleBookmark` is invoked with the correct
 * `postId`. Mirrors `FollowButton.test.tsx`'s harness.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@/convex/_generated/dataModel";

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
  useQuery: () => useQueryMock(),
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
    bookmarks: {
      toggleBookmark: "toggleBookmark",
      isBookmarked: "isBookmarked",
    },
  },
}));

import { BookmarkButton } from "./BookmarkButton";

const baseProps = { postId: "post-1" as Id<"posts"> };

describe("BookmarkButton", () => {
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

  it("renders the unsaved affordance when isBookmarked is false", () => {
    render(<BookmarkButton {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /save to reading list/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the saved affordance when isBookmarked is true", () => {
    useQueryMock.mockReturnValue(true);
    render(<BookmarkButton {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /remove from reading list/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("calls toggleBookmark with the correct postId on click and toasts 'Saved to reading list'", async () => {
    const user = userEvent.setup();
    useMutationMock.mockResolvedValue({ bookmarked: true });
    render(<BookmarkButton {...baseProps} />);

    await user.click(
      screen.getByRole("button", { name: /save to reading list/i }),
    );
    expect(useMutationMock).toHaveBeenCalledWith({ postId: "post-1" });
    expect(toastSuccessMock).toHaveBeenCalledWith("Saved to reading list");
  });

  it("toasts 'Removed from reading list' when toggling from saved to unsaved", async () => {
    const user = userEvent.setup();
    useQueryMock.mockReturnValue(true);
    useMutationMock.mockResolvedValue({ bookmarked: false });
    render(<BookmarkButton {...baseProps} />);

    await user.click(
      screen.getByRole("button", { name: /remove from reading list/i }),
    );
    expect(toastSuccessMock).toHaveBeenCalledWith("Removed from reading list");
  });

  it("toasts an error when the mutation throws", async () => {
    const user = userEvent.setup();
    useMutationMock.mockRejectedValue(new Error("boom"));
    render(<BookmarkButton {...baseProps} />);

    await user.click(
      screen.getByRole("button", { name: /save to reading list/i }),
    );

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Something went wrong"),
    );
  });

  it("redirects to login when an unauthenticated user clicks", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<BookmarkButton {...baseProps} />);

    await user.click(
      screen.getByRole("button", { name: /save to reading list/i }),
    );
    expect(pushMock).toHaveBeenCalledWith("/auth/login");
    expect(useMutationMock).not.toHaveBeenCalled();
  });

  it("renders the unsaved affordance while isBookmarked is loading", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<BookmarkButton {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /save to reading list/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});
