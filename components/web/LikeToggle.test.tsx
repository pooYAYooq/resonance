/**
 * Component tests for the generic LikeToggle primitive.
 *
 * Verifies count rendering, aria attributes, unauthenticated redirect,
 * the onToggle callback being invoked, and the success/error toasts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LikeToggle } from "./LikeToggle";

const {
  useConvexAuthState,
  onToggleMock,
  pushMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  onToggleMock: vi.fn(),
  pushMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const baseProps = {
  isLiked: false,
  count: 0,
  onToggle: onToggleMock,
  ariaLabelLiked: "Unlike",
  ariaLabelNotLiked: "Like",
  toastLiked: "Liked",
  toastUnliked: "Unliked",
};

describe("LikeToggle", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    onToggleMock.mockReset();
    pushMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the count", () => {
    render(<LikeToggle {...baseProps} count={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it.each([
    [0, "0"],
    [1, "1"],
    [10, "10"],
    [100, "100"],
    [999, "999"],
    [1_000, "1k"],
    [999_999, "999k"],
    [1_000_000, "1m"],
    [10_000_000, "10m"],
    [999_999_999, "999m"],
    [1_000_000_000, "1b"],
  ])(
    "renders reader count %i as %s with the exact accessible count",
    (count, text) => {
      render(<LikeToggle {...baseProps} count={count} presentation="reader" />);
      expect(screen.getByText(text)).toHaveClass("tabular-nums");
      expect(screen.getByText(text)).not.toHaveClass("w-[5ch]");
      expect(screen.getByRole("button")).toHaveAccessibleName(
        `Like, ${count.toLocaleString("en-US")} ${count === 1 ? "like" : "likes"}`,
      );
      expect(screen.getByRole("button")).toHaveAttribute(
        "data-variant",
        "outline",
      );
      expect(screen.getByRole("button")).toHaveAttribute("data-size", "lg");
    },
  );

  it("reserves only the Liked label width when toggled", async () => {
    onToggleMock.mockResolvedValue({ liked: true, likeCount: 1 });
    render(<LikeToggle {...baseProps} presentation="reader" />);
    const label = screen.getByText("Like").parentElement;
    expect(label).toHaveClass("inline-grid");
    expect(screen.getByText("Liked")).toHaveClass("invisible");
    await userEvent.setup().click(screen.getByRole("button"));
    expect(
      screen.getByText("Liked", { selector: "span:not(.invisible)" }),
    ).toBeVisible();
    expect(label).toHaveClass("inline-grid");
    expect(screen.getByRole("button")).toHaveAccessibleName("Unlike, 1 like");
  });

  it("preserves compact unformatted counts and ghost styling", () => {
    render(<LikeToggle {...baseProps} count={20_000} />);
    expect(screen.getByText("20000")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "ghost");
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "sm");
  });

  it("sets aria-pressed to true when liked", () => {
    render(<LikeToggle {...baseProps} isLiked={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("uses aria-labelLiked when liked", () => {
    render(<LikeToggle {...baseProps} isLiked={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Unlike");
  });

  it("uses aria-labelNotLiked when not liked", () => {
    render(<LikeToggle {...baseProps} isLiked={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Like");
  });

  it("redirects to login and skips onToggle when unauthenticated", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    window.history.replaceState({}, "", "/blog/post-1?tag=design#comments");
    render(<LikeToggle {...baseProps} />);

    await user.click(screen.getByRole("button"));
    expect(pushMock).toHaveBeenCalledWith(
      "/auth/login?returnTo=%2Fblog%2Fpost-1%3Ftag%3Ddesign%23comments",
    );
    expect(onToggleMock).not.toHaveBeenCalled();
  });

  it("invokes onToggle and toasts on success", async () => {
    const user = userEvent.setup();
    onToggleMock.mockResolvedValue({ liked: true, likeCount: 1 });
    render(<LikeToggle {...baseProps} count={0} />);

    await user.click(screen.getByRole("button"));
    await Promise.resolve();
    await Promise.resolve();

    expect(onToggleMock).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).toHaveBeenCalledWith("Liked");
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("invokes onToggle and toasts error on onToggle failure", async () => {
    const user = userEvent.setup();
    onToggleMock.mockRejectedValue(new Error("boom"));
    render(<LikeToggle {...baseProps} count={0} />);

    await user.click(screen.getByRole("button"));
    await Promise.resolve();
    await Promise.resolve();

    expect(toastErrorMock).toHaveBeenCalledWith("Something went wrong");
  });

  describe.each(["compact", "reader"] as const)(
    "%s pending focus",
    (presentation) => {
      it.each(["success", "failure"])(
        "retains focus and prevents repeat activation through %s",
        async (outcome) => {
          let resolve!: (value: { liked: boolean; likeCount: number }) => void;
          let reject!: (error: Error) => void;
          onToggleMock.mockImplementation(
            () =>
              new Promise((yes, no) => {
                resolve = yes;
                reject = no;
              }),
          );
          const user = userEvent.setup();
          render(<LikeToggle {...baseProps} presentation={presentation} />);
          const button = screen.getByRole("button");
          button.focus();
          await user.keyboard("{Enter}");
          // jsdom does not reproduce Chromium blurring newly disabled buttons.
          // Requiring an enabled, aria-disabled control pins the browser fix.
          expect(button).toBeEnabled();
          expect(button).toHaveAttribute("aria-disabled", "true");
          expect(button).toHaveFocus();
          await user.keyboard("{Enter} ");
          await user.click(button);
          expect(onToggleMock).toHaveBeenCalledTimes(1);
          await act(async () => {
            if (outcome === "success") resolve({ liked: true, likeCount: 1 });
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
            presentation === "reader"
              ? outcome === "success"
                ? "Unlike, 1 like"
                : "Like, 0 likes"
              : outcome === "success"
                ? "Unlike"
                : "Like",
          );
        },
      );

      it("does not pull focus back after the user leaves during a mutation", async () => {
        let resolve!: (value: { liked: boolean; likeCount: number }) => void;
        onToggleMock.mockImplementation(
          () =>
            new Promise((yes) => {
              resolve = yes;
            }),
        );
        const user = userEvent.setup();
        render(
          <>
            <LikeToggle {...baseProps} presentation={presentation} />
            <button>Other control</button>
          </>,
        );
        screen.getByRole("button", { name: /^Like/ }).focus();
        await user.keyboard("{Enter}{Tab}");
        const outside = screen.getByRole("button", { name: "Other control" });
        expect(outside).toHaveFocus();
        await act(async () => resolve({ liked: true, likeCount: 1 }));
        expect(outside).toHaveFocus();
      });
    },
  );

  it("remains natively disabled and cannot mutate while authentication is loading", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
    });
    render(<LikeToggle {...baseProps} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await userEvent.setup().click(button);
    expect(onToggleMock).not.toHaveBeenCalled();
  });
});
