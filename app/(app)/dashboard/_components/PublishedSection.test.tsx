import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  authState,
  currentUserState,
  paginatedState,
  queryArgs,
  paginatedArgs,
  pushMock,
  loadMoreMock,
} = vi.hoisted(() => ({
  authState: vi.fn(),
  currentUserState: vi.fn(),
  paginatedState: vi.fn(),
  queryArgs: vi.fn(),
  paginatedArgs: vi.fn(),
  pushMock: vi.fn(),
  loadMoreMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
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
    posts: { getPostsByAuthorId: "getPostsByAuthorId" },
  },
}));

vi.mock("@/components/web/PostCard", () => ({
  PostCard: ({
    title,
    authorActions,
  }: {
    title: string;
    authorActions?: React.ReactNode;
  }) => (
    <article>
      {title}
      {authorActions}
    </article>
  ),
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
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: loadMoreMock,
      isLoading: false,
    });
    queryArgs.mockReset();
    paginatedArgs.mockReset();
    pushMock.mockReset();
  });

  it("redirects unauthenticated users and skips both queries", async () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });

    render(<PublishedSection />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/auth/login"));
    expect(queryArgs).toHaveBeenCalledWith("skip");
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("waits for the current user before querying published posts", () => {
    currentUserState.mockReturnValue(undefined);

    render(<PublishedSection />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("scopes the query to the current user and renders published cards", () => {
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

  it("renders Edit and View Post actions for published cards", () => {
    paginatedState.mockReturnValue({
      results: [publishedPost],
      status: "Exhausted",
      loadMore: loadMoreMock,
      isLoading: false,
    });

    render(<PublishedSection />);

    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/create?editPostId=posts-1",
    );
    expect(screen.getByRole("link", { name: "View Post" })).toHaveAttribute(
      "href",
      "/blog/posts-1",
    );
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

  it("keeps published cards visible while loading another page", () => {
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
});
