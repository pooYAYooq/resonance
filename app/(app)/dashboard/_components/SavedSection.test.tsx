import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { authState, paginatedState, paginatedArgs, pushMock } = vi.hoisted(
  () => ({
    authState: vi.fn(),
    paginatedState: vi.fn(),
    paginatedArgs: vi.fn(),
    pushMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    paginatedArgs(args);
    return paginatedState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    bookmarks: {
      getBookmarkedPosts: "getBookmarkedPosts",
    },
  },
}));

vi.mock("@/components/web/PostCard", () => ({
  PostCard: ({ title }: { title: string }) => <div>{title}</div>,
}));

import { SavedSection } from "./SavedSection";

describe("SavedSection", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    paginatedArgs.mockReset();
    pushMock.mockReset();
  });

  it("redirects unauthenticated users and skips the saved query", async () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });

    render(<SavedSection />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/auth/login"));
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("offers the Blog when there are no saved posts", () => {
    render(<SavedSection />);

    expect(screen.getByText("No saved posts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the Blog" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(paginatedArgs).toHaveBeenCalledWith({});
  });
});
