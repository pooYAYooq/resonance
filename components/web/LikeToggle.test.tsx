/**
 * Component tests for the generic LikeToggle primitive.
 *
 * Verifies count rendering, aria attributes, unauthenticated redirect,
 * the onToggle callback being invoked, and the success/error toasts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    render(<LikeToggle {...baseProps} />);

    await user.click(screen.getByRole("button"));
    expect(pushMock).toHaveBeenCalledWith("/auth/login");
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
});