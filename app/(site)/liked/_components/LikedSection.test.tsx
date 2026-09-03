import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { authState, paginatedState, paginatedArgs, pushMock } = vi.hoisted(
  () => ({
    authState: vi.fn(),
    paginatedState: vi.fn(),
    paginatedArgs: vi.fn(),
    pushMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    paginatedArgs(args);
    return paginatedState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    likes: {
      getLikedPosts: "getLikedPosts",
    },
  },
}));

vi.mock("@/components/web/PostCard", () => ({
  PostCard: ({ title }: { title: string }) => <article>{title}</article>,
}));

import { LikedSection } from "./LikedSection";

const post = {
  _id: "post-1",
  title: "A liked post",
  body: "Post body",
  imageUrl: null,
  commentCount: 0,
  likeCount: 1,
  isLiked: true,
  isBookmarked: false,
  createdAt: 1_700_000_000_000,
  authorId: "author-1",
  authorName: "Author",
  authorAvatarUrl: null,
  tags: [],
};

describe("LikedSection", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    paginatedArgs.mockReset();
    pushMock.mockReset();
  });

  it("redirects anonymous visitors with the current safe return path", async () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });
    window.history.replaceState({}, "", "/liked?sort=recent#collection");

    render(<LikedSection />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fliked%3Fsort%3Drecent%23collection",
      ),
    );
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("skips the private liked query while authentication is loading", () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: true });

    render(<LikedSection />);

    expect(pushMock).not.toHaveBeenCalled();
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("renders a Liked-specific empty state linking to the Blog", () => {
    render(<LikedSection />);

    expect(screen.getByText("No liked posts")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse the Blog" }),
    ).toHaveAttribute("href", "/blog");
    expect(paginatedArgs).toHaveBeenCalledWith({});
  });

  it("keeps loading available when the current page only contains unavailable posts", async () => {
    const loadMore = vi.fn();
    const user = userEvent.setup();
    paginatedState.mockReturnValue({
      results: [],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });

    render(<LikedSection />);

    expect(screen.queryByText("No liked posts")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(loadMore).toHaveBeenCalledWith(12);
  });

  it("renders liked summaries and loads more", async () => {
    const loadMore = vi.fn();
    const user = userEvent.setup();
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });

    render(<LikedSection />);

    expect(screen.getByText("A liked post")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(loadMore).toHaveBeenCalledWith(12);
  });
});
