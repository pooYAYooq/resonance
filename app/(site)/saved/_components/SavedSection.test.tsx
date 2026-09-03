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
    bookmarks: {
      getBookmarkedPosts: "getBookmarkedPosts",
    },
  },
}));

vi.mock("@/components/web/PostCard", () => ({
  PostCard: ({ title }: { title: string }) => <div>{title}</div>,
}));

import { SavedSection } from "./SavedSection";

const post = {
  _id: "post-1",
  title: "A saved post",
  body: "Post body",
  imageUrl: null,
  commentCount: 0,
  likeCount: 1,
  isLiked: false,
  createdAt: 1_700_000_000_000,
  authorId: "author-1",
  authorName: "Author",
  authorAvatarUrl: null,
  tags: [],
};

const nextPost = {
  ...post,
  _id: "post-2",
  title: "Another saved post",
};

describe("SavedSection", () => {
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

  it("redirects unauthenticated users and skips the saved query", async () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });
    window.history.replaceState({}, "", "/saved");

    render(<SavedSection />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/auth/login?returnTo=%2Fsaved"),
    );
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("announces authentication loading status", () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: true });

    render(<SavedSection />);

    expect(
      screen.getByRole("status", { name: "Loading saved posts" }),
    ).toBeInTheDocument();
  });

  it("announces saved post loading status", () => {
    paginatedState.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
      isLoading: true,
    });

    render(<SavedSection />);

    expect(
      screen.getByRole("status", { name: "Loading saved posts" }),
    ).toBeInTheDocument();
  });

  it("offers the Blog when there are no saved posts", () => {
    render(<SavedSection />);

    expect(screen.getByText("No saved posts")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse the Blog" }),
    ).toHaveAttribute("href", "/blog");
    expect(paginatedArgs).toHaveBeenCalledWith({});
  });

  it("requests and renders a subsequent page of saved posts", async () => {
    let page = 1;
    const loadMore = vi.fn(() => {
      page = 2;
    });
    const user = userEvent.setup();
    paginatedState.mockImplementation(() => ({
      results: page === 1 ? [post] : [post, nextPost],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    }));

    const { rerender } = render(<SavedSection />);

    expect(screen.getByText("A saved post")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(loadMore).toHaveBeenCalledWith(12);

    rerender(<SavedSection />);

    expect(screen.getByText("Another saved post")).toBeInTheDocument();
  });
});
