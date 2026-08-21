import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { authState, userState, paginatedState, paginatedArgs } = vi.hoisted(
  () => ({
    authState: vi.fn(),
    userState: vi.fn(),
    paginatedState: vi.fn(),
    paginatedArgs: vi.fn(),
  }),
);

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
  useQuery: (_query: unknown, args: unknown) =>
    args === "skip" ? undefined : userState(),
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
  PostCard: ({ title }: { title: string }) => <article>{title}</article>,
}));

import { PublishedPreview } from "./PublishedPreview";

describe("PublishedPreview", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
    userState.mockReturnValue({ userId: "user-1" });
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    paginatedArgs.mockReset();
  });

  it("renders an independent loading state", () => {
    paginatedState.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
      isLoading: true,
    });

    render(<PublishedPreview />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("offers a full published section link when empty", () => {
    render(<PublishedPreview />);

    expect(screen.getByText("No published posts yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View published posts" }),
    ).toHaveAttribute("href", "/dashboard/published");
  });

  it("scopes recent posts to the current user", () => {
    paginatedState.mockReturnValue({
      results: [{ _id: "post-1", title: "A published post" }],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<PublishedPreview />);

    expect(paginatedArgs).toHaveBeenCalledWith({ authorId: "user-1" });
    expect(screen.getByText("A published post")).toBeInTheDocument();
  });
});
