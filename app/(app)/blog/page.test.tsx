import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BlogPage from "./page";

vi.mock("@/components/web/AuthCTA", () => ({
  AuthCTA: () => <div data-testid="auth-cta" />,
}));
vi.mock("./_components/BlogPostList", () => ({
  BlogPostList: () => <div data-testid="blog-post-list" />,
}));

describe("BlogPage", () => {
  it("renders an active tag filter from search params", async () => {
    render(
      await BlogPage({ searchParams: Promise.resolve({ tag: "Technology" }) }),
    );
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /clear filter/i })).toHaveAttribute(
      "href",
      "/blog",
    );
  });
});
