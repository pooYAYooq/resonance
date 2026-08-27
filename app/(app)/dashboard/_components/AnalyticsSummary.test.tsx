import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalyticsSummary } from "./AnalyticsSummary";

const { useConvexAuthState, useQueryState, useQueryArgsMock } = vi.hoisted(
  () => ({
    useConvexAuthState: vi.fn(),
    useQueryState: vi.fn(),
    useQueryArgsMock: vi.fn(),
  }),
);

const followerGrowthDays = Array.from({ length: 30 }, (_, index) => ({
  dayStart: Date.UTC(2026, 7, 26) - (29 - index) * 24 * 60 * 60 * 1000,
  gainedCount: index === 29 || index === 27 ? 1 : 0,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: (_query: unknown, args: unknown) => {
    useQueryArgsMock(args);
    return useQueryState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    analytics: {
      getSummary: "getSummary",
    },
  },
}));

describe("AnalyticsSummary", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryState.mockReturnValue(undefined);
    useQueryArgsMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an accessible loading status while the summary is loading", () => {
    render(<AnalyticsSummary />);

    expect(
      screen.getByRole("status", { name: "Loading analytics" }),
    ).toBeInTheDocument();
  });

  it("does not render or subscribe when unauthenticated", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    const { container } = render(<AnalyticsSummary />);

    expect(container).toBeEmptyDOMElement();
    expect(useQueryArgsMock).toHaveBeenLastCalledWith("skip");
  });

  it("renders the private analytics metrics", () => {
    useQueryState.mockReturnValue({
      views: 12,
      likes: 5,
      followerCount: 3,
      followerGrowth: 999,
      followerGrowthStart: 0,
      followerGrowthDays,
    });
    render(<AnalyticsSummary />);

    expect(
      screen.getByRole("heading", { name: "Analytics" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unique Views")).toBeInTheDocument();
    expect(screen.getByText("Likes Received")).toBeInTheDocument();
    expect(screen.getByText("Current Followers")).toBeInTheDocument();
    expect(screen.getByText("New Followers (30 days)")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Follower growth" }),
    ).toBeInTheDocument();
  });

  it("uses singular follower-growth grammar for one gained follower", () => {
    useQueryState.mockReturnValue({
      views: 0,
      likes: 0,
      followerCount: 0,
      followerGrowth: 1,
      followerGrowthStart: 0,
      followerGrowthDays: followerGrowthDays.map((point, index) => ({
        ...point,
        gainedCount: index === 29 ? 1 : 0,
      })),
    });
    render(<AnalyticsSummary />);

    expect(screen.getByText("New Followers (30 days)")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
