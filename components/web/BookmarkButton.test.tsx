/**
 * Component tests for `BookmarkButton`.
 *
 * Verifies the saved / unsaved icon transition, the pending guarded state,
 * the success toasts, and that `toggleBookmark` is invoked with the correct
 * `postId`. Mirrors `FollowButton.test.tsx`'s harness.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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
    bookmarks: {
      toggleBookmark: "toggleBookmark",
      isBookmarked: "isBookmarked",
    },
  },
}));

import { BookmarkButton } from "./BookmarkButton";

const baseProps = { postId: "post-1" as Id<"posts">, isBookmarked: false };

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

  it("shows reader Save and Saved labels without changing its width slot", async () => {
    useMutationMock.mockResolvedValue({ bookmarked: true });
    render(<BookmarkButton {...baseProps} presentation="reader" />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveClass("min-w-24");
    expect(screen.getByRole("button")).toHaveAttribute(
      "data-variant",
      "outline",
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "lg");
    await userEvent.setup().click(screen.getByRole("button"));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveClass("min-w-24");
  });

  it("renders the saved affordance when isBookmarked is true", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<BookmarkButton {...baseProps} isBookmarked={true} />);
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
    window.history.replaceState({}, "", "/blog/post-1?tag=design#save");
    render(<BookmarkButton {...baseProps} />);

    await user.click(
      screen.getByRole("button", { name: /save to reading list/i }),
    );
    expect(pushMock).toHaveBeenCalledWith(
      "/auth/login?returnTo=%2Fblog%2Fpost-1%3Ftag%3Ddesign%23save",
    );
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

  it("skips the private bookmark query until resolved authentication is authenticated", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    render(<BookmarkButton {...baseProps} />);
    expect(useQueryMock).toHaveBeenLastCalledWith("skip");

    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<BookmarkButton {...baseProps} />);
    expect(useQueryMock).toHaveBeenLastCalledWith("skip");
  });

  it("queries bookmarks after resolved authenticated authentication", () => {
    render(<BookmarkButton {...baseProps} />);

    expect(useQueryMock).toHaveBeenLastCalledWith({ postId: "post-1" });
  });

  describe.each(["compact", "reader"] as const)(
    "%s pending focus",
    (presentation) => {
      it.each(["success", "failure"])(
        "retains focus and prevents repeat activation through %s",
        async (outcome) => {
          let resolve!: (value: { bookmarked: boolean }) => void;
          let reject!: (error: Error) => void;
          useMutationMock.mockImplementation(
            () =>
              new Promise((yes, no) => {
                resolve = yes;
                reject = no;
              }),
          );
          const user = userEvent.setup();
          render(<BookmarkButton {...baseProps} presentation={presentation} />);
          const button = screen.getByRole("button");
          button.focus();
          await user.keyboard("{Enter}");
          expect(button).toBeEnabled();
          expect(button).toHaveAttribute("aria-disabled", "true");
          expect(button).toHaveFocus();
          await user.keyboard("{Enter} ");
          await user.click(button);
          expect(useMutationMock).toHaveBeenCalledTimes(1);
          expect(useMutationMock).toHaveBeenCalledWith({ postId: "post-1" });
          await act(async () => {
            if (outcome === "success") resolve({ bookmarked: true });
            else reject(new Error("Rejected test mutation"));
          });
          await waitFor(() =>
            expect(button).toHaveAttribute("aria-disabled", "false"),
          );
          expect(button).toHaveFocus();
          expect(button).toHaveAttribute(
            "aria-pressed",
            outcome === "success" ? "true" : "false",
          );
          expect(button).toHaveAccessibleName(
            outcome === "success"
              ? "Remove from reading list"
              : "Save to reading list",
          );
        },
      );

      it("does not pull focus back after the user leaves during a mutation", async () => {
        let resolve!: (value: { bookmarked: boolean }) => void;
        useMutationMock.mockImplementation(
          () =>
            new Promise((yes) => {
              resolve = yes;
            }),
        );
        const user = userEvent.setup();
        render(
          <>
            <BookmarkButton {...baseProps} presentation={presentation} />
            <button>Other control</button>
          </>,
        );
        screen.getByRole("button", { name: "Save to reading list" }).focus();
        await user.keyboard("{Enter}{Tab}");
        const outside = screen.getByRole("button", { name: "Other control" });
        expect(outside).toHaveFocus();
        await act(async () => resolve({ bookmarked: true }));
        expect(outside).toHaveFocus();
      });
    },
  );

  it("remains natively disabled and cannot mutate while authentication is loading", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
    });
    render(<BookmarkButton {...baseProps} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await userEvent.setup().click(button);
    expect(useMutationMock).not.toHaveBeenCalled();
    expect(useQueryMock).toHaveBeenLastCalledWith("skip");
  });
});
