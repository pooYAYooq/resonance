import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  authState,
  paramsState,
  pushMock,
  paginatedQueryArgsMock,
  queryArgsMock,
  paginatedQueryState,
  queryState,
} = vi.hoisted(() => ({
  authState: vi.fn(),
  paramsState: vi.fn(),
  pushMock: vi.fn(),
  paginatedQueryArgsMock: vi.fn(),
  queryArgsMock: vi.fn(),
  paginatedQueryState: vi.fn(),
  queryState: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => paramsState(),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
  useMutation: () => vi.fn(),
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    paginatedQueryArgsMock(args);
    return paginatedQueryState();
  },
  useQuery: (_query: unknown, args: unknown) => {
    queryArgsMock(args);
    return queryState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    comments: {
      createComment: "createComment",
      getCommentsByPostId: "getCommentsByPostId",
    },
    posts: { getPostById: "getPostById" },
  },
}));

vi.mock("./CommentCard", () => ({
  CommentCard: ({ body }: { body: string }) => <article>{body}</article>,
}));

import { CommentSection } from "./CommentSection";

describe("CommentSection", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });
    paramsState.mockReturnValue({ postId: "post-1" });
    paginatedQueryArgsMock.mockClear();
    queryArgsMock.mockClear();
    paginatedQueryState.mockReturnValue({
      results: [],
      status: "Exhausted",
      isLoading: false,
      loadMore: vi.fn(),
    });
    queryState.mockReturnValue({ commentCount: 0 });
  });

  it("shows auth CTAs with the current location to anonymous visitors", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/blog/post-1?tab=comments#reply");

    render(<CommentSection initialTotalCount={0} />);

    expect(screen.queryByPlaceholderText("Add a comment...")).toBeNull();
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(pushMock).toHaveBeenCalledWith(
      "/auth/login?returnTo=%2Fblog%2Fpost-1%3Ftab%3Dcomments%23reply",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    expect(pushMock).toHaveBeenCalledWith(
      "/auth/sign-up?returnTo=%2Fblog%2Fpost-1%3Ftab%3Dcomments%23reply",
    );
  });

  it("skips public comment reads while authentication resolves", () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: true });

    render(<CommentSection initialTotalCount={0} />);

    expect(paginatedQueryArgsMock).toHaveBeenLastCalledWith("skip");
    expect(queryArgsMock).toHaveBeenLastCalledWith("skip");
  });

  it("reads comments publicly after anonymous authentication resolves", () => {
    render(<CommentSection initialTotalCount={0} />);

    expect(paginatedQueryArgsMock).toHaveBeenLastCalledWith({
      postId: "post-1",
    });
    expect(queryArgsMock).toHaveBeenLastCalledWith({ postId: "post-1" });
  });

  it("reads comments with the authenticated client after authentication resolves", () => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });

    render(<CommentSection initialTotalCount={0} />);

    expect(paginatedQueryArgsMock).toHaveBeenLastCalledWith({
      postId: "post-1",
    });
    expect(queryArgsMock).toHaveBeenLastCalledWith({ postId: "post-1" });
  });

  it("renders public comment bodies for signed-out visitors", () => {
    paginatedQueryState.mockReturnValue({
      results: [
        {
          _id: "comment-1",
          authorName: "Ada",
          body: "A public comment",
          createdAt: 0,
          authorId: "author-1",
          authorAvatarUrl: null,
          isLiked: false,
          likeCount: 0,
        },
      ],
      status: "Exhausted",
      isLoading: false,
      loadMore: vi.fn(),
    });

    render(<CommentSection initialTotalCount={1} />);

    expect(screen.getByText("A public comment")).toBeInTheDocument();
    expect(screen.queryByText("Loading comments...")).toBeNull();
  });
});
