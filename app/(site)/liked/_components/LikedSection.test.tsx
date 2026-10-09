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
        {/* Titles with "locked like" or "locked bookmark" pin disabled toggles for fallback tests. */}
        {isLiked && (
          <button
            aria-label={`Unlike ${title}`}
            aria-pressed="true"
            disabled={title.includes("locked like")}
          >
            Unlike
          </button>
        )}
        {isBookmarked && (
          <button
            aria-label={`Remove ${title}`}
            aria-pressed="true"
            disabled={title.includes("locked bookmark")}
          >
            Remove
          </button>
        )}
      </article>
    ),
  };
});

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

const secondPost = {
  ...post,
  _id: "post-2",
  title: "Another liked post",
  authorName: "Second Author",
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

  it("moves focus to the nearest surviving item when a liked post is removed", async () => {
    paginatedState.mockReturnValue({
      results: [post, secondPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<LikedSection />);
    screen.getByRole("button", { name: "Unlike A liked post" }).focus();

    paginatedState.mockReturnValue({
      results: [secondPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<LikedSection />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Unlike Another liked post" }),
      ).toHaveFocus(),
    );
  });

  it("moves focus to the recovery link when the last liked post is removed", async () => {
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<LikedSection />);
    screen.getByRole("button", { name: "Unlike A liked post" }).focus();

    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<LikedSection />);

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Browse the Blog" }),
      ).toHaveFocus(),
    );
  });

  it("restores focus when a paginated refill replaces a removed liked post", async () => {
    const thirdPost = { ...post, _id: "post-3", title: "A third liked post" };
    paginatedState.mockReturnValue({
      results: [post, secondPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<LikedSection />);
    screen.getByRole("button", { name: "Unlike A liked post" }).focus();

    // The refilled page keeps two items, replacing the removed one.
    paginatedState.mockReturnValue({
      results: [secondPost, thirdPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<LikedSection />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Unlike Another liked post" }),
      ).toHaveFocus(),
    );
  });

  it("restores focus to the same toggle when items have different tag counts", async () => {
    const taggedPost = {
      ...post,
      _id: "post-2",
      title: "A tagged liked post",
      tags: ["alpha", "beta"],
    };
    paginatedState.mockReturnValue({
      results: [post, taggedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<LikedSection />);
    screen.getByRole("button", { name: "Unlike A liked post" }).focus();

    paginatedState.mockReturnValue({
      results: [taggedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<LikedSection />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Unlike A tagged liked post" }),
      ).toHaveFocus(),
    );
  });

  it("restores focus to the first enabled control when the matching toggle is disabled", async () => {
    const lockedPost = {
      ...post,
      _id: "post-2",
      title: "A locked like post",
    };
    paginatedState.mockReturnValue({
      results: [post, lockedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<LikedSection />);
    screen.getByRole("button", { name: "Unlike A liked post" }).focus();

    paginatedState.mockReturnValue({
      results: [lockedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<LikedSection />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Author" })).toHaveFocus(),
    );
  });

  it("moves focus to the first appended item after activating Load more", async () => {
    const user = userEvent.setup();
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<LikedSection />);
    screen.getByRole("button", { name: "Load more" }).focus();
    await user.keyboard("{Enter}");

    // The pagination control unmounts while the next page loads.
    paginatedState.mockReturnValue({
      results: [post],
      status: "LoadingMore",
      loadMore: vi.fn(),
      isLoading: true,
    });
    rerender(<LikedSection />);

    // The next page arrives and appends after the existing item.
    paginatedState.mockReturnValue({
      results: [post, secondPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<LikedSection />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Second Author" })).toHaveFocus(),
    );
  });

  it("does not substitute a different toggle when the recorded one is disabled", async () => {
    const lockedPost = {
      ...post,
      _id: "post-2",
      title: "A locked like post",
      isBookmarked: true,
    };
    paginatedState.mockReturnValue({
      results: [post, lockedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<LikedSection />);
    screen.getByRole("button", { name: "Unlike A liked post" }).focus();

    paginatedState.mockReturnValue({
      results: [lockedPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<LikedSection />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Author" })).toHaveFocus(),
    );
  });

  it("moves focus to the first appended item after Load more on an empty page", async () => {
    const user = userEvent.setup();
    paginatedState.mockReturnValue({
      results: [],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const { rerender } = render(<LikedSection />);
    screen.getByRole("button", { name: "Load more" }).focus();
    await user.keyboard("{Enter}");

    // The empty page swaps to a spinner without the list root while loading.
    paginatedState.mockReturnValue({
      results: [],
      status: "LoadingMore",
      loadMore: vi.fn(),
      isLoading: true,
    });
    rerender(<LikedSection />);

    // The next page arrives and renders the first card.
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(<LikedSection />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Author" })).toHaveFocus(),
    );
  });

  it("does not restore focus after the user leaves the list", async () => {
    paginatedState.mockReturnValue({
      results: [post, secondPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    const view = () => (
      <>
        <button type="button">Outside target</button>
        <LikedSection />
      </>
    );
    const { rerender } = render(view());
    screen.getByRole("button", { name: "Unlike A liked post" }).focus();
    screen.getByRole("button", { name: "Outside target" }).focus();
    (document.activeElement as HTMLElement).blur();

    // The stale control is removed while focus rests on the document body.
    paginatedState.mockReturnValue({
      results: [secondPost],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    rerender(view());

    await waitFor(() => expect(document.body).toHaveFocus());
  });
});
