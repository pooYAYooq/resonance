import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  authState,
  currentUserState,
  paginatedState,
  queryArgs,
  paginatedArgs,
  loadMoreMock,
  deleteMock,
} = vi.hoisted(() => ({
  authState: vi.fn(),
  currentUserState: vi.fn(),
  paginatedState: vi.fn(),
  queryArgs: vi.fn(),
  paginatedArgs: vi.fn(),
  loadMoreMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => deleteMock,
  useConvexAuth: () => authState(),
  useQuery: (_query: unknown, args: unknown) => {
    queryArgs(args);
    return args === "skip" ? undefined : currentUserState();
  },
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    paginatedArgs(args);
    return paginatedState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: { getCurrentUser: "getCurrentUser" },
    posts: {
      getPostsByAuthorId: "getPostsByAuthorId",
      deletePublishedPost: "deletePublishedPost",
    },
  },
}));

import { PublishedSection } from "./PublishedSection";

const currentUser = { userId: "auth-user-1" };
const publishedPost = {
  _id: "posts-1",
  title: "Published story",
  body: "body",
  imageUrl: null,
  commentCount: 2,
  likeCount: 3,
  isLiked: false,
  createdAt: 1,
  publishedAt: 1,
  updatedAt: 1,
  authorId: "auth-user-1",
  authorName: "Ada",
  authorAvatarUrl: null,
  tags: [],
};

describe("PublishedSection", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
    currentUserState.mockReturnValue(currentUser);
    loadMoreMock.mockReset();
    deleteMock.mockReset().mockResolvedValue(undefined);
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: loadMoreMock,
      isLoading: false,
    });
    queryArgs.mockReset();
    paginatedArgs.mockReset();
  });

  it("waits for the current user before querying published posts", () => {
    currentUserState.mockReturnValue(undefined);

    render(<PublishedSection />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("scopes the query to the current user and renders published rows", () => {
    paginatedState.mockReturnValue({
      results: [publishedPost],
      status: "Exhausted",
      loadMore: loadMoreMock,
      isLoading: false,
    });

    render(<PublishedSection />);

    expect(queryArgs).toHaveBeenCalledWith({});
    expect(paginatedArgs).toHaveBeenCalledWith({ authorId: "auth-user-1" });
    expect(screen.getByText("Published story")).toBeInTheDocument();
  });

  it("links the title to the reader and exposes Edit and Delete actions", () => {
    paginatedState.mockReturnValue({
      results: [publishedPost],
      status: "Exhausted",
      loadMore: loadMoreMock,
      isLoading: false,
    });

    render(<PublishedSection />);

    expect(
      screen.getByRole("link", { name: "Edit Published story" }),
    ).toHaveAttribute("href", "/create?editPostId=posts-1");
    expect(
      screen.getByRole("link", { name: "Published story" }),
    ).toHaveAttribute("href", "/blog/posts-1");
    expect(
      screen.getByRole("button", { name: "Delete Published story" }),
    ).toBeEnabled();
  });

  it("offers New Post and Drafts actions when there are no published posts", () => {
    render(<PublishedSection />);

    expect(screen.getByText("No published posts yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(screen.getByRole("link", { name: "View Drafts" })).toHaveAttribute(
      "href",
      "/dashboard/drafts",
    );
  });

  it("loads another page with the established page size", async () => {
    paginatedState.mockReturnValue({
      results: [publishedPost],
      status: "CanLoadMore",
      loadMore: loadMoreMock,
      isLoading: false,
    });

    const user = userEvent.setup();
    render(<PublishedSection />);
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(loadMoreMock).toHaveBeenCalledWith(12);
  });

  it("keeps published rows visible while loading another page", () => {
    paginatedState.mockReturnValue({
      results: [publishedPost],
      status: "CanLoadMore",
      loadMore: loadMoreMock,
      isLoading: true,
    });

    render(<PublishedSection />);

    expect(screen.getByText("Published story")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Loading more..." }),
    ).toBeDisabled();
  });
  function showPosts(posts = [publishedPost]) {
    paginatedState.mockReturnValue({
      results: posts,
      status: "Exhausted",
      loadMore: loadMoreMock,
      isLoading: false,
    });
  }

  it.each([
    { isAuthenticated: false, isLoading: true },
    { isAuthenticated: true, isLoading: true },
    { isAuthenticated: false, isLoading: false },
  ])("skips private queries while auth is unavailable: %j", (auth) => {
    authState.mockReturnValue(auth);
    render(<PublishedSection />);
    expect(queryArgs).toHaveBeenCalledWith("skip");
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("names the selected post and restores focus on cancellation without deleting", async () => {
    showPosts();
    const user = userEvent.setup();
    render(<PublishedSection />);
    const trigger = screen.getByRole("button", {
      name: "Delete Published story",
    });
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("Delete published post?");
    expect(dialog).toHaveAccessibleDescription(
      /Published story.*cannot be undone/i,
    );
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and blocks duplicate submissions and cancellation while pending", async () => {
    showPosts();
    let resolve!: () => void;
    deleteMock.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const user = userEvent.setup();
    render(<PublishedSection />);
    await user.click(
      screen.getByRole("button", { name: "Delete Published story" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete Post" }));
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Deleting…" }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(dialog).toBeInTheDocument();
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith({ postId: "posts-1" });
    await act(async () => resolve());
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("shows a recoverable deletion error and permits retry", async () => {
    showPosts();
    deleteMock.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    render(<PublishedSection />);
    await user.click(
      screen.getByRole("button", { name: "Delete Published story" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
    expect(screen.getByRole("article", { hidden: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Post" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(deleteMock).toHaveBeenCalledTimes(2);
  });

  it("restores focus to the next row when the deleted row disappears before mutation resolution", async () => {
    const next = { ...publishedPost, _id: "posts-2", title: "Next story" };
    showPosts([publishedPost, next]);
    let resolve!: () => void;
    deleteMock.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const user = userEvent.setup();
    const view = render(<PublishedSection />);
    await user.click(
      screen.getByRole("button", { name: "Delete Published story" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete Post" }));
    showPosts([next]);
    view.rerender(<PublishedSection />);
    await act(async () => resolve());
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Edit Next story" }),
      ).toHaveFocus(),
    );
  });

  it("restores focus to New Post after deleting the last row", async () => {
    showPosts();
    let resolve!: () => void;
    deleteMock.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const user = userEvent.setup();
    const view = render(<PublishedSection />);
    await user.click(
      screen.getByRole("button", { name: "Delete Published story" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete Post" }));
    showPosts([]);
    view.rerender(<PublishedSection />);
    await act(async () => resolve());
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "New Post" })).toHaveFocus(),
    );
  });

  it("restores focus when the last row disappears after mutation resolution", async () => {
    showPosts();
    const user = userEvent.setup();
    const view = render(<PublishedSection />);
    await user.click(
      screen.getByRole("button", { name: "Delete Published story" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete Post" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    showPosts([]);
    view.rerender(<PublishedSection />);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "New Post" })).toHaveFocus(),
    );
  });

  it.each(["next", "previous"])(
    "keeps focus on the %s Edit link when the query updates after mutation resolution",
    async (direction) => {
      const neighbor = {
        ...publishedPost,
        _id: "posts-2",
        title: "Neighbor story",
      };
      showPosts(
        direction === "next"
          ? [publishedPost, neighbor]
          : [neighbor, publishedPost],
      );
      const user = userEvent.setup();
      const view = render(<PublishedSection />);
      await user.click(
        screen.getByRole("button", { name: "Delete Published story" }),
      );
      await user.click(screen.getByRole("button", { name: "Delete Post" }));
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(
          screen.getByRole("link", { name: "Edit Neighbor story" }),
        ).toHaveFocus(),
      );
      showPosts([neighbor]);
      view.rerender(<PublishedSection />);
      expect(
        screen.getByRole("link", { name: "Edit Neighbor story" }),
      ).toHaveFocus();
    },
  );
});
