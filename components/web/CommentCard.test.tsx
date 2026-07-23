/**
 * Component tests for CommentCard — verifies author/body/timestamp render
 * and that the like button receives the comment's like count and liked state.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommentCard } from "./CommentCard";
import type { Id } from "@/convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
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
  commentId: "comment-1" as Id<"comments">,
  authorName: "Alice",
  body: "Great post!",
  createdAt: 1_000,
  authorId: "user-2",
  authorAvatarUrl: null,
  isLiked: false,
  likeCount: 0,
};

describe("CommentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the author name and body", () => {
    render(<CommentCard {...baseProps} body="Hello world" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders the comment like count from props", () => {
    render(<CommentCard {...baseProps} likeCount={9} />);
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("uses the 'Like this comment' aria-label when not liked", () => {
    render(<CommentCard {...baseProps} isLiked={false} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Like this comment",
    );
  });

  it("uses the 'Unlike this comment' aria-label when liked", () => {
    render(<CommentCard {...baseProps} isLiked={true} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Unlike this comment",
    );
  });
});
