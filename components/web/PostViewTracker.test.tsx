import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";

const { useConvexAuthState, recordViewMock, useMutationSpy } = vi.hoisted(
  () => ({
    useConvexAuthState: vi.fn(),
    recordViewMock: vi.fn(),
    useMutationSpy: vi.fn(() => recordViewMock),
  }),
);

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useMutation: useMutationSpy,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    analytics: {
      recordView: "recordView",
    },
  },
}));

import { PostViewTracker } from "./PostViewTracker";

const postId = "post-1" as Id<"posts">;

describe("PostViewTracker", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    recordViewMock.mockReset();
    recordViewMock.mockResolvedValue(null);
    useMutationSpy.mockClear();
  });

  it("does not record a view for an unauthenticated visitor", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    render(<PostViewTracker postId={postId} />);

    expect(recordViewMock).not.toHaveBeenCalled();
  });

  it("does not record a view while authentication is loading", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    render(<PostViewTracker postId={postId} />);

    expect(recordViewMock).not.toHaveBeenCalled();
  });

  it("records a view when authentication finishes for an authenticated visitor", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    const { rerender } = render(<PostViewTracker postId={postId} />);

    expect(recordViewMock).not.toHaveBeenCalled();

    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    rerender(<PostViewTracker postId={postId} />);

    expect(recordViewMock).toHaveBeenCalledTimes(1);
    expect(recordViewMock).toHaveBeenCalledWith({ postId });
  });

  it("records the view for an authenticated ready visitor", () => {
    render(<PostViewTracker postId={postId} />);

    expect(recordViewMock).toHaveBeenCalledWith({ postId });
  });

  it("does not render a status region", () => {
    render(<PostViewTracker postId={postId} />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
