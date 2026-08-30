import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useConvexAuthState, useQueryState, queryArgsMock, pushMock } =
  vi.hoisted(() => ({
    useConvexAuthState: vi.fn(),
    useQueryState: vi.fn(),
    queryArgsMock: vi.fn(),
    pushMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: (query: unknown, args: unknown) => {
    queryArgsMock(query, args);
    return useQueryState(args);
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { feed: { getFeed: "getFeed" } },
}));

vi.mock("@/components/web/PostCard", () => ({
  PostCard: ({ title, postId }: { title: string; postId: string }) => (
    <article data-testid="post-card" data-post-id={postId}>
      {title}
    </article>
  ),
}));

import { FeedContent } from "./FeedContent";

const post = (postId: string, title: string) => ({
  _id: postId,
  _creationTime: 0,
  title,
  body: "Body",
  authorId: "author-1",
  imageUrl: null,
  commentCount: 0,
  likeCount: 0,
  isLiked: false,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  authorName: "Author",
  authorAvatarUrl: null,
});

describe("FeedContent", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryState.mockReturnValue({
      page: [],
      isDone: true,
      continueCursor: "",
    });
    queryArgsMock.mockClear();
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users and skips the feed query", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    window.history.replaceState({}, "", "/feed?filter=following#latest");
    render(<FeedContent />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Ffeed%3Ffilter%3Dfollowing%23latest",
      ),
    );
    expect(queryArgsMock).toHaveBeenCalledWith("getFeed", "skip");
  });

  it("does not redirect or start the feed query while auth is loading", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
    });
    render(<FeedContent />);

    expect(pushMock).not.toHaveBeenCalled();
    expect(queryArgsMock).toHaveBeenCalledWith("getFeed", "skip");
  });

  it("renders the empty state for an authenticated empty feed", async () => {
    render(<FeedContent />);

    expect(await screen.findByText("Your feed is empty")).toBeInTheDocument();
    expect(screen.getByText(/Follow authors/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("uses a fixed cutoff and bounded query contract", () => {
    render(<FeedContent />);

    const [, args] = queryArgsMock.mock.calls.at(-1) ?? [];
    expect(args).toMatchObject({
      asOf: expect.any(Number),
      paginationOpts: {
        numItems: 20,
        maximumRowsRead: 20,
        cursor: null,
      },
    });
  });

  it("renders a page and shows Load More only when another page exists", async () => {
    useQueryState.mockReturnValue({
      page: [post("post-1", "First post")],
      isDone: false,
      continueCursor: "cursor-1",
    });
    render(<FeedContent />);

    expect(await screen.findByText("First post")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /load more/i }),
    ).toBeInTheDocument();
  });

  it("deduplicates post IDs across loaded pages", async () => {
    useQueryState.mockImplementation(
      (args: { paginationOpts: { cursor: string | null } } | "skip") =>
        args === "skip" || args.paginationOpts.cursor === null
          ? {
              page: [post("post-1", "First post")],
              isDone: false,
              continueCursor: "cursor-1",
            }
          : {
              page: [
                post("post-1", "First post"),
                post("post-2", "Second post"),
              ],
              isDone: true,
              continueCursor: "",
            },
    );
    const user = userEvent.setup();
    render(<FeedContent />);

    await user.click(await screen.findByRole("button", { name: /load more/i }));
    await waitFor(() =>
      expect(screen.getAllByTestId("post-card")).toHaveLength(2),
    );
    expect(screen.getAllByText("First post")).toHaveLength(1);
    expect(screen.getByText("Second post")).toBeInTheDocument();
  });
});
