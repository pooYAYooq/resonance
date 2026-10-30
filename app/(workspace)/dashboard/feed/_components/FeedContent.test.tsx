import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

vi.mock("@/components/web/FeedPostCard", () => ({
  FeedPostCard: ({
    title,
    postId,
    isBookmarked,
    featured,
  }: {
    title: string;
    postId: string;
    isBookmarked: boolean;
    featured?: boolean;
  }) => (
    <article
      data-slot="card"
      data-testid="feed-card"
      data-post-id={postId}
      data-is-bookmarked={isBookmarked}
      data-featured={String(Boolean(featured))}
    >
      <a href={`/blog/${postId}`}>{title}</a>
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
  isBookmarked: false,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  publishedAt: 1_700_000_000_000,
  authorName: "Author",
  authorUsername: "author",
  authorAvatarUrl: null,
  tags: [],
});

function stubIntersectionObserver() {
  let callback: IntersectionObserverCallback | undefined;
  let observed = false;

  class MockIntersectionObserver {
    root = null;
    rootMargin = "";
    thresholds = [];

    constructor(cb: IntersectionObserverCallback) {
      callback = cb;
    }

    observe() {
      observed = true;
    }

    unobserve() {}

    disconnect() {}

    takeRecords() {
      return [];
    }
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

  return {
    trigger() {
      callback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    },
    wasObserved() {
      return observed;
    },
  };
}

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
    vi.unstubAllGlobals();
  });

  it("redirects unauthenticated users and skips the feed query", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    window.history.replaceState(
      {},
      "",
      "/dashboard/feed?filter=following#latest",
    );
    render(<FeedContent />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fdashboard%2Ffeed%3Ffilter%3Dfollowing%23latest",
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
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "href",
      "/blog",
    );
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

  it("auto-loads the next page when the sentinel intersects", async () => {
    const observer = stubIntersectionObserver();
    useQueryState.mockImplementation(
      (args: { paginationOpts: { cursor: string | null } } | "skip") =>
        args === "skip" || args.paginationOpts.cursor === null
          ? {
              page: [post("post-1", "First post")],
              isDone: false,
              continueCursor: "cursor-1",
            }
          : {
              page: [post("post-2", "Second post")],
              isDone: true,
              continueCursor: "",
            },
    );
    render(<FeedContent />);

    await screen.findByText("First post");
    expect(observer.wasObserved()).toBe(true);
    act(() => observer.trigger());

    await waitFor(() =>
      expect(screen.getByText("Second post")).toBeInTheDocument(),
    );
  });

  it("does not pass a featured flag to any feed card", async () => {
    useQueryState.mockReturnValue({
      page: [post("post-1", "First post"), post("post-2", "Second post")],
      isDone: true,
      continueCursor: "",
    });
    render(<FeedContent />);

    const cards = await screen.findAllByTestId("feed-card");
    expect(
      cards.every((card) => card.getAttribute("data-featured") !== "true"),
    ).toBe(true);
  });

  it("keeps focus when auto-load removes the final Load more button", async () => {
    const observer = stubIntersectionObserver();
    useQueryState.mockImplementation(
      (args: { paginationOpts: { cursor: string | null } } | "skip") =>
        args === "skip" || args.paginationOpts.cursor === null
          ? {
              page: [post("post-1", "First post")],
              isDone: false,
              continueCursor: "cursor-1",
            }
          : {
              page: [post("post-2", "Second post")],
              isDone: true,
              continueCursor: "",
            },
    );
    render(<FeedContent />);

    const button = screen.getByRole("button", { name: "Load more" });
    button.focus();
    await screen.findByText("First post");
    act(() => observer.trigger());

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Second post" })).toHaveFocus(),
    );
  });

  it("restores focus when the button is focused during an auto-load and the final page removes it", async () => {
    const observer = stubIntersectionObserver();
    const firstPage = {
      page: [post("post-1", "First post")],
      isDone: false,
      continueCursor: "cursor-1",
    };
    const nextPage: {
      current:
        | {
            page: ReturnType<typeof post>[];
            isDone: boolean;
            continueCursor: string;
          }
        | undefined;
    } = { current: undefined };
    useQueryState.mockImplementation(
      (args: { paginationOpts: { cursor: string | null } } | "skip") =>
        args === "skip" || args.paginationOpts.cursor === null
          ? firstPage
          : nextPage.current,
    );
    const view = render(<FeedContent />);

    await screen.findByText("First post");
    act(() => observer.trigger());
    const button = screen.getByRole("button", { name: /loading/i });
    button.focus();

    nextPage.current = {
      page: [post("post-2", "Second post")],
      isDone: true,
      continueCursor: "",
    };
    view.rerender(<FeedContent />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Second post" })).toHaveFocus(),
    );
  });

  it("passes the hydrated bookmark state to each feed card", async () => {
    useQueryState.mockReturnValue({
      page: [{ ...post("post-1", "Saved post"), isBookmarked: true }],
      isDone: true,
      continueCursor: "",
    });
    render(<FeedContent />);

    expect(await screen.findByTestId("feed-card")).toHaveAttribute(
      "data-is-bookmarked",
      "true",
    );
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
      expect(screen.getAllByTestId("feed-card")).toHaveLength(2),
    );
    expect(screen.getAllByText("First post")).toHaveLength(1);
    expect(screen.getByText("Second post")).toBeInTheDocument();
  });

  describe("pagination focus", () => {
    const first = post("post-1", "First post");
    const second = post("post-2", "Second post");
    const third = post("post-3", "Third post");
    const initialPage = {
      page: [first],
      isDone: false,
      continueCursor: "cursor-1",
    };
    type Page = typeof initialPage;
    let nextPage: Page | undefined;

    beforeEach(() => {
      nextPage = undefined;
      useQueryState.mockImplementation(
        (args: { paginationOpts: { cursor: string | null } } | "skip") =>
          args !== "skip" && args.paginationOpts.cursor === null
            ? initialPage
            : nextPage,
      );
    });

    it.each([false, true])(
      "keeps pagination focus while pending and focuses appended content (exhausted=%s)",
      async (isDone) => {
        const user = userEvent.setup();
        const view = render(<FeedContent />);
        const button = screen.getByRole("button", { name: "Load more" });
        button.focus();
        await user.keyboard("{Enter}");
        expect(screen.getByRole("link", { name: "First post" })).toBeVisible();
        expect(button).toHaveFocus();
        expect(button).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("status")).toHaveTextContent("Loading more");
        await user.keyboard("{Enter}{Enter}");
        nextPage = { page: [second], isDone, continueCursor: "cursor-2" };
        view.rerender(<FeedContent />);
        expect(screen.getByRole("link", { name: "Second post" })).toHaveFocus();
        expect(screen.getAllByTestId("feed-card")).toHaveLength(2);
      },
    );

    it("uses the current unique-item boundary on a second pagination request", async () => {
      const user = userEvent.setup();
      const view = render(<FeedContent />);
      screen.getByRole("button", { name: "Load more" }).focus();
      await user.keyboard("{Enter}");
      nextPage = {
        page: [first, second],
        isDone: false,
        continueCursor: "cursor-2",
      };
      view.rerender(<FeedContent />);
      expect(screen.getByRole("link", { name: "Second post" })).toHaveFocus();
      screen.getByRole("button", { name: "Load more" }).focus();
      nextPage = undefined;
      await user.keyboard("{Enter}");
      expect(screen.getAllByTestId("feed-card")).toHaveLength(2);
      nextPage = { page: [second, third], isDone: true, continueCursor: "" };
      view.rerender(<FeedContent />);
      expect(screen.getByRole("link", { name: "Third post" })).toHaveFocus();
      expect(screen.getAllByTestId("feed-card")).toHaveLength(3);
    });

    it.each([{ page: [] }, { page: [first] }])(
      "keeps the settled pagination control focused when no unique posts append (%j)",
      async ({ page }) => {
        const user = userEvent.setup();
        const view = render(<FeedContent />);
        screen.getByRole("button", { name: "Load more" }).focus();
        await user.keyboard("{Enter}");
        nextPage = { page, isDone: false, continueCursor: "cursor-2" };
        view.rerender(<FeedContent />);
        expect(screen.getByRole("button", { name: "Load more" })).toHaveFocus();
        expect(
          screen.getByRole("button", { name: "Load more" }),
        ).toHaveAttribute("aria-disabled", "false");
      },
    );

    it("falls back to the last surviving card when an empty page exhausts", async () => {
      const user = userEvent.setup();
      const view = render(<FeedContent />);
      screen.getByRole("button", { name: "Load more" }).focus();
      await user.keyboard("{Enter}");
      nextPage = { page: [], isDone: true, continueCursor: "" };
      view.rerender(<FeedContent />);
      expect(screen.getByRole("link", { name: "First post" })).toHaveFocus();
    });

    it("falls back to Blog when an empty scanning feed exhausts", async () => {
      useQueryState.mockImplementation(
        (args: { paginationOpts: { cursor: string | null } } | "skip") =>
          args !== "skip" && args.paginationOpts.cursor === null
            ? { ...initialPage, page: [] }
            : nextPage,
      );
      const user = userEvent.setup();
      const view = render(<FeedContent />);
      const button = screen.getByRole("button", { name: "Load more" });
      button.focus();
      await user.keyboard("{Enter}");
      expect(button).toHaveFocus();
      nextPage = { page: [], isDone: true, continueCursor: "" };
      view.rerender(<FeedContent />);
      expect(screen.getByRole("link", { name: "Blog" })).toHaveFocus();
    });

    it("keeps Chromium removal focusout from canceling the final-page restore", async () => {
      const user = userEvent.setup();
      const view = render(<FeedContent />);
      const button = screen.getByRole("button", { name: "Load more" });
      button.focus();
      await user.keyboard("{Enter}");
      fireEvent.focusOut(button, { relatedTarget: null });
      nextPage = { page: [second], isDone: true, continueCursor: "" };
      view.rerender(<FeedContent />);
      expect(screen.getByRole("link", { name: "Second post" })).toHaveFocus();
    });

    it.each(["outside", "card", "blur"])(
      "does not steal focus after a deliberate %s departure while pending",
      async (departure) => {
        const user = userEvent.setup();
        const content = () => (
          <>
            <FeedContent />
            <button>Outside target</button>
          </>
        );
        const view = render(content());
        const button = screen.getByRole("button", { name: "Load more" });
        button.focus();
        await user.keyboard("{Enter}");
        if (departure === "outside") {
          screen.getByRole("button", { name: "Outside target" }).focus();
        } else if (departure === "card") {
          screen.getByRole("link", { name: "First post" }).focus();
        } else {
          button.blur();
        }
        await Promise.resolve();
        nextPage = { page: [second], isDone: true, continueCursor: "" };
        view.rerender(content());
        if (departure === "outside") {
          expect(
            screen.getByRole("button", { name: "Outside target" }),
          ).toHaveFocus();
        } else if (departure === "card") {
          expect(
            screen.getByRole("link", { name: "First post" }),
          ).toHaveFocus();
        } else {
          expect(document.body).toHaveFocus();
        }
      },
    );
  });
});
