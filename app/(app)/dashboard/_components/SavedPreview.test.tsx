import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { authState, paginatedState } = vi.hoisted(() => ({
  authState: vi.fn(),
  paginatedState: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
  usePaginatedQuery: () => paginatedState(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { bookmarks: { getBookmarkedPosts: "getBookmarkedPosts" } },
}));
vi.mock("@/components/web/PostCard", () => ({
  PostCard: ({ title }: { title: string }) => <article>{title}</article>,
}));

import { SavedPreview } from "./SavedPreview";

describe("SavedPreview", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
  });

  it("renders an independent loading state", () => {
    paginatedState.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
      isLoading: true,
    });

    render(<SavedPreview />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("offers Blog and full saved-section links when empty", () => {
    render(<SavedPreview />);

    expect(screen.getByText("No saved posts yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse the Blog" }),
    ).toHaveAttribute("href", "/blog");
    expect(
      screen.getByRole("link", { name: "View saved posts" }),
    ).toHaveAttribute("href", "/dashboard/saved");
  });

  it("renders recent saved posts", () => {
    paginatedState.mockReturnValue({
      results: [{ _id: "post-1", title: "A saved post" }],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<SavedPreview />);

    expect(screen.getByText("A saved post")).toBeInTheDocument();
  });
});
