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
  useMutation: () => vi.fn(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    posts: {
      getDrafts: "getDrafts",
      deleteDraft: "deleteDraft",
    },
  },
}));

import { DraftsSection } from "./DraftsSection";

describe("DraftsSection", () => {
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

  it("redirects unauthenticated users and skips the draft query", async () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });

    render(<DraftsSection />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/auth/login"));
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("announces draft loading status", () => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: true });

    render(<DraftsSection />);

    expect(
      screen.getByRole("status", { name: "Loading drafts" }),
    ).toBeInTheDocument();
  });

  it("offers to create a post when there are no drafts", () => {
    render(<DraftsSection />);

    expect(screen.getByText("No drafts yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(paginatedArgs).toHaveBeenCalledWith({});
  });
});
