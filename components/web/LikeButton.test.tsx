/**
 * Component tests for the LikeButton.
 *
 * Verifies the button renders the correct like count, heart state, aria
 * attributes, and unauthenticated redirect behaviour.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LikeButton } from "./LikeButton";
import type { Id } from "@/convex/_generated/dataModel";

const {
  useConvexAuthState,
  useMutationMock,
  pushMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  useMutationMock: vi.fn(),
  pushMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
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
    likes: {
      toggleLike: "toggleLike",
    },
  },
}));

const baseProps = {
  postId: "post-123" as Id<"posts">,
  isLiked: false,
  likeCount: 0,
};

describe("LikeButton", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useMutationMock.mockClear();
    pushMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the like count", () => {
    render(<LikeButton {...baseProps} likeCount={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("sets aria-pressed to true when liked", () => {
    render(<LikeButton {...baseProps} isLiked={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("sets aria-pressed to false when not liked", () => {
    render(<LikeButton {...baseProps} isLiked={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("redirects to login when unauthenticated user clicks", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<LikeButton {...baseProps} />);

    await user.click(screen.getByRole("button"));
    expect(pushMock).toHaveBeenCalledWith("/auth/login");
    expect(useMutationMock).not.toHaveBeenCalled();
  });

  it("uses aria-label 'Unlike this post' when liked", () => {
    render(<LikeButton {...baseProps} isLiked={true} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Unlike this post",
    );
  });

  it("uses aria-label 'Like this post' when not liked", () => {
    render(<LikeButton {...baseProps} isLiked={false} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Like this post",
    );
  });
});
