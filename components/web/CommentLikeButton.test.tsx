/**
 * Component tests for CommentLikeButton — a thin LikeToggle wrapper bound to
 * api.likes.toggleCommentLike. Verifies count rendering, liked/unliked aria
 * state, and that the right mutation reference and comment id are wired up.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommentLikeButton } from "./CommentLikeButton";
import type { Id } from "@/convex/_generated/dataModel";

const { useConvexAuthState, useMutationMock, useMutationSpy } = vi.hoisted(
  () => ({
    useConvexAuthState: vi.fn(),
    useMutationMock: vi.fn(),
    // Captures which mutation reference the wrapper passed to useMutation at
    // render, while still handing back useMutationMock so the click path works.
    useMutationSpy: vi.fn(() => useMutationMock),
  }),
);

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useMutation: useMutationSpy,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    likes: {
      toggleLike: "toggleLike",
      toggleCommentLike: "toggleCommentLike",
    },
  },
}));

const baseProps = {
  commentId: "comment-123" as Id<"comments">,
  isLiked: false,
  likeCount: 0,
};

describe("CommentLikeButton", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useMutationMock.mockClear();
    useMutationSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the like count", () => {
    render(<CommentLikeButton {...baseProps} likeCount={4} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("sets aria-pressed to true when liked", () => {
    render(<CommentLikeButton {...baseProps} isLiked={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("uses comment-specific aria-label when liked", () => {
    render(<CommentLikeButton {...baseProps} isLiked={true} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Unlike this comment",
    );
  });

  it("uses comment-specific aria-label when not liked", () => {
    render(<CommentLikeButton {...baseProps} isLiked={false} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Like this comment",
    );
  });

  it("wires the toggleCommentLike mutation reference at render", () => {
    render(<CommentLikeButton {...baseProps} />);
    expect(useMutationSpy).toHaveBeenCalledWith("toggleCommentLike");
  });

  it("calls toggleCommentLike with the comment id on click", async () => {
    useMutationMock.mockResolvedValue({ liked: true, likeCount: 1 });
    render(<CommentLikeButton {...baseProps} />);

    fireEvent.click(screen.getByRole("button"));
    await vi.waitFor(() =>
      expect(useMutationMock).toHaveBeenCalledWith({
        commentId: "comment-123",
      }),
    );
  });
});
