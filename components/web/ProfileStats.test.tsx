/**
 * Component tests for `ProfileStats`.
 *
 * Verifies the initial server-rendered render uses the `initial*`
 * props (so SSR is not blocked on a query snap), that a `useQuery`
 * snap overrides the initial values once subscribed, and that
 * counts are pluralized ("1 Follower" vs "2 Followers").
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => useQueryMock(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    follows: {
      getFollowCounts: "getFollowCounts",
    },
  },
}));

import { ProfileStats } from "./ProfileStats";

describe("ProfileStats", () => {
  afterEach(() => {
    useQueryMock.mockReset();
  });

  it("renders the initial counts from props while the query is loading", () => {
    useQueryMock.mockReturnValue(undefined);
    render(
      <ProfileStats
        profileUserId="user-1"
        initialFollowerCount={7}
        initialFollowingCount={3}
      />,
    );
    expect(screen.getByText(/7 Followers/i)).toBeInTheDocument();
    expect(screen.getByText(/3 Following/i)).toBeInTheDocument();
  });

  it("renders updated counts when the query snap arrives", () => {
    useQueryMock.mockReturnValue({ followerCount: 12, followingCount: 5 });
    render(
      <ProfileStats
        profileUserId="user-1"
        initialFollowerCount={7}
        initialFollowingCount={3}
      />,
    );
    expect(screen.getByText(/12 Followers/i)).toBeInTheDocument();
    expect(screen.getByText(/5 Following/i)).toBeInTheDocument();
  });

  it("pluralizes 'Follower' for the singular case", () => {
    useQueryMock.mockReturnValue({ followerCount: 1, followingCount: 1 });
    render(
      <ProfileStats
        profileUserId="user-1"
        initialFollowerCount={0}
        initialFollowingCount={0}
      />,
    );
    expect(screen.getByText(/1 Follower\b/)).toBeInTheDocument();
  });
});
