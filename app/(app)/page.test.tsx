import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
  it("does not render inert topic cards or pseudo-metrics", () => {
    render(<Home />);

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
  });
});
