/**
 * Component tests for `ReadingListContent`'s auth gate and empty state.
 *
 * Mirrors `app/(app)/create/page.test.tsx`'s gate-testing precedent.
 * The paginated-card rendering path is covered by `BookmarkButton` and
 * `PostCard` consumers + manual testing (see 1.5 spec Section 3).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const {
  useConvexAuthState,
  usePaginatedState,
  usePaginatedQueryArgsMock,
  pushMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  usePaginatedState: vi.fn(),
  usePaginatedQueryArgsMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    usePaginatedQueryArgsMock(args);
    return usePaginatedState();
  },
  useMutation: () => vi.fn(),
  useQuery: () => vi.fn(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    bookmarks: {
      getBookmarkedPosts: "getBookmarkedPosts",
      toggleBookmark: "toggleBookmark",
      isBookmarked: "isBookmarked",
    },
    likes: {
      toggleLike: "toggleLike",
    },
  },
}));

import { ReadingListContent } from "./ReadingListContent";

describe("ReadingListContent", () => {
  beforeEach(() => {
    pushMock.mockClear();
    usePaginatedQueryArgsMock.mockClear();
    usePaginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /auth/login when unauthenticated", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<ReadingListContent />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/auth/login"),
    );
    expect(usePaginatedQueryArgsMock).toHaveBeenCalledWith("skip");
  });

  it("shows a loading spinner while auth is resolving", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    const { container } = render(<ReadingListContent />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a loading spinner while the bookmark list is loading", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
      isLoading: true,
    });
    const { container } = render(<ReadingListContent />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows the empty state when authenticated with no saved posts", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<ReadingListContent />);

    expect(screen.getByText("No saved posts")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Bookmark posts to read later and they'll appear here\./i,
      ),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(usePaginatedQueryArgsMock).toHaveBeenCalledWith({});
  });
});
