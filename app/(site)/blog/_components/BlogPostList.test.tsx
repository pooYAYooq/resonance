import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  discoverPostsQuery,
  topicPostsQuery,
  paginatedState,
  paginatedQuery,
  paginatedArgs,
  blogCard,
} = vi.hoisted(() => ({
  discoverPostsQuery: { name: "getDiscoverPosts" },
  topicPostsQuery: { name: "getTopicPosts" },
  paginatedState: vi.fn(),
  paginatedQuery: vi.fn(),
  paginatedArgs: vi.fn(),
  blogCard: vi.fn(
    ({
      post: summaryPost,
      priority,
    }: {
      post: { _id: string; title: string };
      priority?: boolean;
    }) => (
      <article data-slot="card" data-priority={String(Boolean(priority))}>
        <a href={`/blog/${summaryPost._id}`}>{summaryPost.title}</a>
      </article>
    ),
  ),
}));

vi.mock("convex/react", () => ({
  usePaginatedQuery: (query: unknown, args: unknown) => {
    paginatedQuery(query);
    paginatedArgs(args);
    return paginatedState();
  },
}));
vi.mock("@/convex/_generated/api", () => ({
  api: {
    discover: {
      getDiscoverPosts: discoverPostsQuery,
      getTopicPosts: topicPostsQuery,
    },
  },
}));
vi.mock("./BlogPostCard", () => ({
  BlogPostCard: blogCard,
}));

import { BlogPostList } from "./BlogPostList";

const post = {
  _id: "post-1",
  title: "Latest post",
  bodyText: "Plain excerpt",
  imageUrl: null,
  commentCount: 2,
  likeCount: 4,
  publishedAt: 1,
  authorId: "author-1",
  authorName: "Author",
  tags: ["Technology"],
};

describe("BlogPostList", () => {
  beforeEach(() => {
    paginatedState.mockReset();
    paginatedQuery.mockReset();
    paginatedArgs.mockReset();
    blogCard.mockClear();
  });

  it("uses the latest discover query and loads the next page", async () => {
    const loadMore = vi.fn();
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });

    render(<BlogPostList mode={{ mode: "latest" }} />);
    expect(screen.getByText("Latest post")).toBeInTheDocument();
    expect(paginatedQuery).toHaveBeenCalledWith(discoverPostsQuery);
    expect(paginatedArgs).toHaveBeenCalledWith({ mode: "latest" });
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(loadMore).toHaveBeenCalledWith(12);
  });

  it("renders every result as the same row and prioritizes only the first cover", () => {
    const second = { ...post, _id: "post-2", title: "Second post" };
    paginatedState.mockReturnValue({
      results: [post, second],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<BlogPostList mode={{ mode: "latest" }} />);

    expect(screen.getByTestId("blog-post-list")).toHaveClass(
      "max-md:gap-2",
      "max-md:divide-y",
      "max-md:divide-foreground/20",
    );
    expect(screen.getByText("Latest post").closest("article")).toHaveAttribute(
      "data-priority",
      "true",
    );
    expect(screen.getByText("Second post").closest("article")).toHaveAttribute(
      "data-priority",
      "false",
    );
    expect(blogCard.mock.calls[0][0]).toEqual({ post, priority: true });
    expect(blogCard.mock.calls[1][0]).toEqual({
      post: second,
      priority: false,
    });
  });

  it("reserves the Load more slot when the final page removes the button", () => {
    paginatedState.mockReturnValue({
      results: [post],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<BlogPostList mode={{ mode: "latest" }} />);

    const slot = screen.getByTestId("blog-load-more-slot");
    expect(slot).toHaveClass("min-h-16");
    expect(within(slot).queryByRole("button")).toBeNull();
  });

  it("places Load more inside the reserved slot", () => {
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<BlogPostList mode={{ mode: "latest" }} />);

    expect(
      within(screen.getByTestId("blog-load-more-slot")).getByRole("button", {
        name: /load more/i,
      }),
    ).toBeInTheDocument();
  });

  it("keeps Load more visible and disabled while loading another page", () => {
    paginatedState.mockReturnValue({
      results: [post],
      status: "LoadingMore",
      loadMore: vi.fn(),
      isLoading: true,
    });

    render(<BlogPostList mode={{ mode: "latest" }} />);

    const button = screen.getByRole("button", { name: /loading more/i });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
  });

  it("announces loading and appended results while the control stays", async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();
    const second = { ...post, _id: "post-2", title: "Second post" };
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });

    const view = render(<BlogPostList mode={{ mode: "latest" }} />);
    const button = screen.getByRole("button", { name: /load more/i });
    await user.click(button);
    expect(loadMore).toHaveBeenCalledWith(12);

    paginatedState.mockReturnValue({
      results: [post],
      status: "LoadingMore",
      loadMore,
      isLoading: true,
    });
    view.rerender(<BlogPostList mode={{ mode: "latest" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading more posts.");
    await user.click(button);
    expect(loadMore).toHaveBeenCalledTimes(1);

    paginatedState.mockReturnValue({
      results: [post, second],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });
    view.rerender(<BlogPostList mode={{ mode: "latest" }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Showing 2 posts.");
    expect(button).toHaveFocus();
  });

  it("moves focus to the first appended post and announces completion when the final page removes Load more", async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();
    const second = { ...post, _id: "post-2", title: "Second post" };
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });

    const view = render(<BlogPostList mode={{ mode: "latest" }} />);
    const button = screen.getByRole("button", { name: /load more/i });
    button.focus();
    await user.click(button);

    paginatedState.mockReturnValue({
      results: [post],
      status: "LoadingMore",
      loadMore,
      isLoading: true,
    });
    view.rerender(<BlogPostList mode={{ mode: "latest" }} />);

    paginatedState.mockReturnValue({
      results: [post, second],
      status: "Exhausted",
      loadMore,
      isLoading: false,
    });
    view.rerender(<BlogPostList mode={{ mode: "latest" }} />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Second post" })).toHaveFocus(),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing all 2 posts.",
    );
  });

  it("clears the loading message when a page settles without new posts", async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });

    const view = render(<BlogPostList mode={{ mode: "latest" }} />);
    await user.click(screen.getByRole("button", { name: /load more/i }));

    paginatedState.mockReturnValue({
      results: [post],
      status: "LoadingMore",
      loadMore,
      isLoading: true,
    });
    view.rerender(<BlogPostList mode={{ mode: "latest" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading more posts.");

    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });
    view.rerender(<BlogPostList mode={{ mode: "latest" }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 post.");
  });

  it("updates the announcement when the mode changes", async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });

    const view = render(<BlogPostList mode={{ mode: "latest" }} />);
    await user.click(screen.getByRole("button", { name: /load more/i }));

    paginatedState.mockReturnValue({
      results: [post],
      status: "LoadingMore",
      loadMore,
      isLoading: true,
    });
    view.rerender(<BlogPostList mode={{ mode: "latest" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading more posts.");

    paginatedState.mockReturnValue({
      results: [post],
      status: "LoadingFirstPage",
      loadMore,
      isLoading: true,
    });
    view.rerender(<BlogPostList mode={{ mode: "search", query: "design" }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 post.");
  });

  it("uses the topic query and loads the next page", async () => {
    const loadMore = vi.fn();
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });

    render(<BlogPostList mode={{ mode: "topic", tag: "Technology" }} />);
    expect(paginatedQuery).toHaveBeenCalledWith(topicPostsQuery);
    expect(paginatedArgs).toHaveBeenCalledWith({ tag: "Technology" });
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(loadMore).toHaveBeenCalledWith(12);
  });

  it("recovers from an empty topic", () => {
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<BlogPostList mode={{ mode: "topic", tag: "Technology" }} />);
    expect(
      screen.getByText(/no posts found for technology/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /browse all posts/i }),
    ).toHaveAttribute("href", "/blog#blog-results");
  });

  it("uses the search query and loads the next page", async () => {
    const loadMore = vi.fn();
    paginatedState.mockReturnValue({
      results: [post],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });

    render(<BlogPostList mode={{ mode: "search", query: "design" }} />);
    expect(paginatedQuery).toHaveBeenCalledWith(discoverPostsQuery);
    expect(paginatedArgs).toHaveBeenCalledWith({
      mode: "search",
      query: "design",
    });
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(loadMore).toHaveBeenCalledWith(12);
  });

  it("shows normalized search text and a reset link for no results", () => {
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<BlogPostList mode={{ mode: "search", query: "noise" }} />);
    expect(screen.getByText(/no results for.*noise/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /clear search/i })).toHaveAttribute(
      "href",
      "/blog#blog-results",
    );
  });

  it("shows a static empty state when latest has no published content", () => {
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<BlogPostList mode={{ mode: "latest" }} />);
    expect(screen.getByText(/nothing published yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
