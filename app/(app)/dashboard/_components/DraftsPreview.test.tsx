import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { authState, paginatedState, paginatedArgs } = vi.hoisted(() => ({
  authState: vi.fn(),
  paginatedState: vi.fn(),
  paginatedArgs: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    paginatedArgs(args);
    return paginatedState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { posts: { getDrafts: "getDrafts" } },
}));

vi.mock("./DraftRow", () => ({
  DraftRow: ({ draft }: { draft: { title: string } }) => (
    <div>{draft.title}</div>
  ),
}));

import { DraftsPreview } from "./DraftsPreview";

describe("DraftsPreview", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
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

    render(<DraftsPreview />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(paginatedArgs).toHaveBeenCalledWith({});
  });

  it("offers writing and full drafts actions when empty", () => {
    render(<DraftsPreview />);

    expect(screen.getByText("No drafts yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start writing" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(
      screen.getByRole("link", { name: "View all drafts" }),
    ).toHaveAttribute("href", "/dashboard/drafts");
  });

  it("renders recent drafts with Resume links and a full-section link", () => {
    paginatedState.mockReturnValue({
      results: [
        {
          _id: "draft-1",
          title: "A draft",
          excerpt: "Excerpt",
          tags: [],
          updatedAt: 1,
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<DraftsPreview />);

    expect(screen.getByText("A draft")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View all drafts" }),
    ).toHaveAttribute("href", "/dashboard/drafts");
  });
});
