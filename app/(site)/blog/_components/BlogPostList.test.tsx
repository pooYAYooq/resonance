import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  discoverPostsQuery,
  topicPostsQuery,
  paginatedState,
  paginatedQuery,
  paginatedArgs,
} = vi.hoisted(() => ({
  discoverPostsQuery: { name: "getDiscoverPosts" },
  topicPostsQuery: { name: "getTopicPosts" },
  paginatedState: vi.fn(),
  paginatedQuery: vi.fn(),
  paginatedArgs: vi.fn(),
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
    expect(screen.getByText("Plain excerpt")).toBeInTheDocument();
    expect(paginatedQuery).toHaveBeenCalledWith(discoverPostsQuery);
    expect(paginatedArgs).toHaveBeenCalledWith({ mode: "latest" });
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(loadMore).toHaveBeenCalledWith(12);
  });

  it("keeps Load more visible and disabled while loading another page", () => {
    paginatedState.mockReturnValue({
      results: [post],
      status: "LoadingMore",
      loadMore: vi.fn(),
      isLoading: true,
    });

    render(<BlogPostList mode={{ mode: "latest" }} />);

    expect(
      screen.getByRole("button", { name: /loading more/i }),
    ).toBeDisabled();
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
      screen.getByRole("link", { name: /browse latest/i }),
    ).toHaveAttribute("href", "/blog");
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
      "/blog",
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
