import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BlogPage from "./page";

vi.mock("@/components/web/AuthCTA", () => ({
  AuthCTA: () => <div data-testid="auth-cta" />,
}));
const { discoverSearch, discoverTopics, blogTopicsMenu, blogPostList, topics } =
  vi.hoisted(() => ({
    discoverSearch: vi.fn(() => <div data-testid="discover-search" />),
    discoverTopics: vi.fn(() => <div data-testid="discover-topics" />),
    blogTopicsMenu: vi.fn(() => <div data-testid="blog-topics-menu" />),
    blogPostList: vi.fn(() => <div data-testid="blog-post-list" />),
    topics: [
      { tag: "Technology", publishedCount: 12 },
      { tag: "Design", publishedCount: 3 },
    ],
  }));
vi.mock("@/lib/auth-server", () => ({
  fetchAuthQuery: vi.fn().mockResolvedValue(topics),
}));
vi.mock("./_components/DiscoverSearch", () => ({
  DiscoverSearch: discoverSearch,
}));
vi.mock("./_components/DiscoverTopics", () => ({
  DiscoverTopics: discoverTopics,
}));
vi.mock("./_components/BlogTopicsMenu", () => ({
  BlogTopicsMenu: blogTopicsMenu,
}));
vi.mock("./_components/BlogPostList", () => ({
  BlogPostList: blogPostList,
}));

describe("BlogPage", () => {
  beforeEach(() => {
    discoverSearch.mockClear();
    discoverTopics.mockClear();
    blogTopicsMenu.mockClear();
    blogPostList.mockClear();
  });

  it("passes topic mode to focused children", async () => {
    render(
      await BlogPage({ searchParams: Promise.resolve({ tag: "Technology" }) }),
    );
    expect(discoverSearch).toHaveBeenLastCalledWith({ query: "" }, undefined);
    expect(blogTopicsMenu).toHaveBeenCalledWith(
      { topics, mode: { mode: "topic", tag: "Technology" } },
      undefined,
    );
    expect(discoverTopics).toHaveBeenCalledWith(
      { mode: { mode: "topic", tag: "Technology" }, topics },
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

    expect(discoverTopics).toHaveBeenCalledWith(
      { mode: { mode: "topic", tag: "Technology" }, topics },
      undefined,
    );
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

    expect(
      screen.getByRole("heading", { name: "All posts" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("blog-hero")).toHaveClass(
      "-mx-4",
      "pt-0",
      "md:pt-8",
      "lg:pt-12",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Stories that echo" }),
    ).toHaveClass("text-4xl", "sm:text-5xl", "md:text-6xl", "lg:text-7xl");
    expect(
      screen.getByText(
        "Ideas, experiments, and conversations from curious minds.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A collection of ideas, experiments/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("blog-filter-sticky")).toHaveClass(
      "sticky",
      "top-[64px]",
      "py-3",
      "[@media(max-height:500px)]:py-2",
      "md:top-[56px]",
    );
    expect(screen.getByTestId("blog-topics-sidebar")).toHaveClass(
      "xl:sticky",
      "xl:top-[138px]",
    );
    expect(screen.getByTestId("blog-filter-bar")).toHaveClass(
      "[@media(max-height:500px)]:flex-row",
      "sm:flex-row",
    );
    expect(container.querySelector("#blog-results")).toHaveClass(
      "scroll-mt-[236px]",
      "[@media(max-height:500px)]:scroll-mt-[96px]",
      "sm:scroll-mt-[168px]",
      "md:scroll-mt-[160px]",
    );
    const search = screen.getByTestId("discover-search");
    const menu = screen.getByTestId("blog-topics-menu");
    const main = container.querySelector("main");
    const sidebar = screen.getByTestId("discover-topics");
    expect(search.compareDocumentPosition(menu)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(menu.compareDocumentPosition(main!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(main!.compareDocumentPosition(sidebar)).toBe(
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

    expect(screen.getByRole("link", { name: "All posts" })).toHaveAttribute(
      "href",
      "/blog#blog-results",
    );
  });
});
