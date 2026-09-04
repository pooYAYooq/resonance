import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BlogPage from "./page";

vi.mock("@/components/web/AuthCTA", () => ({
  AuthCTA: () => <div data-testid="auth-cta" />,
}));
const { discoverSearch, discoverTopics, blogPostList } = vi.hoisted(() => ({
  discoverSearch: vi.fn(() => <div data-testid="discover-search" />),
  discoverTopics: vi.fn(() => <div data-testid="discover-topics" />),
  blogPostList: vi.fn(() => <div data-testid="blog-post-list" />),
}));
vi.mock("./_components/DiscoverSearch", () => ({
  DiscoverSearch: discoverSearch,
}));
vi.mock("./_components/DiscoverTopics", () => ({
  DiscoverTopics: discoverTopics,
}));
vi.mock("./_components/BlogPostList", () => ({
  BlogPostList: blogPostList,
}));

describe("BlogPage", () => {
  beforeEach(() => {
    discoverSearch.mockClear();
    discoverTopics.mockClear();
    blogPostList.mockClear();
  });

  it("passes topic mode to focused children", async () => {
    render(
      await BlogPage({ searchParams: Promise.resolve({ tag: "Technology" }) }),
    );
    expect(discoverSearch).toHaveBeenLastCalledWith({ query: "" }, undefined);
    expect(discoverTopics).toHaveBeenCalledWith(
      { mode: { mode: "topic", tag: "Technology" } },
      undefined,
    );
    expect(blogPostList).toHaveBeenLastCalledWith(
      { mode: { mode: "topic", tag: "Technology" } },
      undefined,
    );
  });

  it("uses the first value when the tag query parameter is repeated", async () => {
    render(
      await BlogPage({
        searchParams: Promise.resolve({ tag: ["Technology", "Design"] }),
      }),
    );

    expect(discoverTopics).toHaveBeenCalled();
  });

  it("does not select a topic when a non-empty search query is present", async () => {
    render(
      await BlogPage({
        searchParams: Promise.resolve({
          q: " design ",
          tag: "Technology",
          sort: "latest",
        }),
      }),
    );

    expect(discoverSearch).toHaveBeenLastCalledWith(
      { query: "design" },
      undefined,
    );
  });

  it("passes the normalized mode to focused children", async () => {
    render(
      await BlogPage({
        searchParams: Promise.resolve({ q: " design ", tag: "Technology" }),
      }),
    );

    expect(discoverSearch).toHaveBeenLastCalledWith(
      { query: "design" },
      undefined,
    );
    expect(blogPostList).toHaveBeenLastCalledWith(
      { mode: { mode: "search", query: "design" } },
      undefined,
    );
  });

  it("renders search, results, and topics in reader order without Hot", async () => {
    const { container } = render(
      await BlogPage({ searchParams: Promise.resolve({}) }),
    );

    const search = screen.getByTestId("discover-search");
    const main = container.querySelector("main");
    const topics = screen.getByTestId("discover-topics");
    expect(search.compareDocumentPosition(main!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(main!.compareDocumentPosition(topics)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(container.textContent).not.toMatch(/hot/i);
  });

  it("renders mode-switch links without incompatible parameters", async () => {
    render(
      await BlogPage({
        searchParams: Promise.resolve({ q: "design", tag: "Technology" }),
      }),
    );

    expect(screen.getByRole("link", { name: "Latest" })).toHaveAttribute(
      "href",
      "/blog",
    );
  });
});
