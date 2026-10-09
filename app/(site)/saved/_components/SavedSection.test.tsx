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

vi.mock("@/components/web/PostCard", async () => {
  const Link = (await import("next/link")).default;
  return {
    PostCard: ({
      title,
      tags,
      authorName,
      isLiked,
      isBookmarked,
    }: {
      title: string;
      tags?: string[];
      authorName: string | null;
      isLiked: boolean;
      isBookmarked: boolean;
    }) => (
      <article data-slot="card">
        <Link href="/u/author">{authorName}</Link>
        <Link href={`/blog/${title}`}>{title}</Link>
        {(tags ?? []).map((tag) => (
          <Link key={tag} href={`/blog?tag=${tag}`}>
            {tag}
          </Link>
        ))}
        {/* The "locked" title convention lets tests pin the disabled-target fallback. */}
        {isLiked && (
          <button
            aria-label={`Unlike ${title}`}
            aria-pressed="true"
            disabled={title.includes("locked")}
          >
            Unlike
          </button>
        )}
        {isBookmarked && (
          <button
            aria-label={`Remove ${title}`}
            aria-pressed="true"
            disabled={title.includes("locked")}
          >
            Remove
          </button>
        )}
      </article>
    ),
  };
});

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

  it("moves focus to the nearest surviving item when a saved post is removed", async () => {
    paginatedState.mockReturnValue({
      results: [post, nextPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<SavedSection />);
    screen.getByRole("button", { name: "Remove A saved post" }).focus();

    paginatedState.mockReturnValue({
      results: [nextPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<SavedSection />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove Another saved post" }),
      ).toHaveFocus(),
    );
  });

  it("moves focus to the recovery link when the last saved post is removed", async () => {
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<SavedSection />);
    screen.getByRole("button", { name: "Remove A saved post" }).focus();

    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<SavedSection />);

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Browse the Blog" }),
      ).toHaveFocus(),
    );
  });

  it("restores focus when a paginated refill replaces a removed saved post", async () => {
    const thirdPost = { ...post, _id: "post-3", title: "A third saved post" };
    paginatedState.mockReturnValue({
      results: [post, nextPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<SavedSection />);
    screen.getByRole("button", { name: "Remove A saved post" }).focus();

    // The refilled page keeps two items, replacing the removed one.
    paginatedState.mockReturnValue({
      results: [nextPost, thirdPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<SavedSection />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove Another saved post" }),
      ).toHaveFocus(),
    );
  });

  it("restores focus to the same toggle when items have different tag counts", async () => {
    const taggedPost = {
      ...post,
      _id: "post-2",
      title: "A tagged saved post",
      tags: ["alpha", "beta"],
    };
    paginatedState.mockReturnValue({
      results: [post, taggedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<SavedSection />);
    screen.getByRole("button", { name: "Remove A saved post" }).focus();

    paginatedState.mockReturnValue({
      results: [taggedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<SavedSection />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove A tagged saved post" }),
      ).toHaveFocus(),
    );
  });

  it("restores focus to the first enabled control when the matching toggle is disabled", async () => {
    const lockedPost = {
      ...post,
      _id: "post-2",
      title: "A locked saved post",
    };
    paginatedState.mockReturnValue({
      results: [post, lockedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<SavedSection />);
    screen.getByRole("button", { name: "Remove A saved post" }).focus();

    paginatedState.mockReturnValue({
      results: [lockedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<SavedSection />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Author" })).toHaveFocus(),
    );
  });
});
