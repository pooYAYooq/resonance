import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { authState, paginatedQueryArgsMock, paginatedQueryState } = vi.hoisted(
  () => ({
    authState: vi.fn(),
    paginatedQueryArgsMock: vi.fn(),
    paginatedQueryState: vi.fn(),
  }),
);

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    paginatedQueryArgsMock(args);
    return paginatedQueryState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { posts: { getPostsByAuthorId: "getPostsByAuthorId" } },
}));

vi.mock("@/components/web/PostCard", () => ({
  PostCard: ({ title }: { title: string }) => <article>{title}</article>,
}));

import { ProfilePostList } from "./ProfilePostList";

describe("ProfilePostList", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });
    paginatedQueryArgsMock.mockClear();
    paginatedQueryState.mockReturnValue({
      results: [],
      status: "Exhausted",
      isLoading: false,
      loadMore: vi.fn(),
    });
  });

  it("skips the viewer-aware public query while authentication resolves", () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: true });

    render(<ProfilePostList userId="author-1" />);

    expect(paginatedQueryArgsMock).toHaveBeenLastCalledWith("skip");
  });

  it("reads public posts after anonymous authentication resolves", () => {
    render(<ProfilePostList userId="author-1" />);

    expect(paginatedQueryArgsMock).toHaveBeenLastCalledWith({
      authorId: "author-1",
    });
  });

  it("reads viewer-aware posts after authenticated authentication resolves", () => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });

    render(<ProfilePostList userId="author-1" />);

    expect(paginatedQueryArgsMock).toHaveBeenLastCalledWith({
      authorId: "author-1",
    });
  });

  it("renders public post cards instead of a loading state for signed-out visitors", () => {
    paginatedQueryState.mockReturnValue({
      results: [
        {
          _id: "post-1",
          title: "A public post",
          body: "Body",
          imageUrl: null,
          commentCount: 0,
          likeCount: 0,
          isLiked: false,
          createdAt: 0,
          authorId: "author-1",
          authorName: "Ada",
          authorAvatarUrl: null,
          tags: [],
        },
      ],
      status: "Exhausted",
      isLoading: false,
      loadMore: vi.fn(),
    });

    render(<ProfilePostList userId="author-1" />);

    expect(screen.getByText("A public post")).toBeInTheDocument();
    expect(screen.queryByText("Loading posts...")).toBeNull();
  });
});
