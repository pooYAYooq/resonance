import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { isAuthenticatedMock, redirectMock, redirectError } = vi.hoisted(() => ({
  isAuthenticatedMock: vi.fn(),
  redirectMock: vi.fn(),
  redirectError: new Error("NEXT_REDIRECT"),
}));

vi.mock("@/lib/auth-server", () => ({
  isAuthenticated: isAuthenticatedMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("./_components/HeroSection", () => ({
  HeroSection: () => <section>Hero</section>,
}));
vi.mock("./_components/FeaturesSection", () => ({
  FeaturesSection: () => <section>Features</section>,
}));
vi.mock("./_components/RecentPostsSection", () => ({
  RecentPostsSection: () => <section>Recent posts</section>,
}));
vi.mock("./_components/RecentPostsSkeleton", () => ({
  RecentPostsSkeleton: () => <section>Loading posts</section>,
}));
vi.mock("./_components/StatsSection", () => ({
  StatsSection: () => <section>Stats</section>,
}));
import Home from "./page";

describe("Home", () => {
  it("redirects an authenticated visitor to /dashboard without rendering Home", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    redirectMock.mockImplementation(() => {
      throw redirectError;
    });

    await expect(Home()).rejects.toBe(redirectError);

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByText("Hero")).toBeNull();
  });

  it("renders the marketing page for an anonymous visitor", async () => {
    isAuthenticatedMock.mockResolvedValue(false);
    render(await Home());

    for (const claim of [
      "Explore Topics",
      "Coming soon",
      "Active Writers",
      "Growing",
      "Conversations",
      "Daily",
    ]) {
      expect(screen.queryByText(claim)).toBeNull();
    }

    expect(screen.getByText("Hero")).toBeInTheDocument();
  });
});
