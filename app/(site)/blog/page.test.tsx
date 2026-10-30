import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlogPage from "./page";

vi.mock("@/components/web/AuthCTA", () => ({
  AuthCTA: () => <div data-testid="auth-cta" />,
}));
const { push, discoverTopics, blogTopicsMenu, blogPostList, topics } =
  vi.hoisted(() => ({
    push: vi.fn(),
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
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
    push.mockClear();
    discoverTopics.mockClear();
    blogTopicsMenu.mockClear();
    blogPostList.mockClear();
  });

  it("passes topic mode to focused children", async () => {
    render(
      await BlogPage({ searchParams: Promise.resolve({ tag: "Technology" }) }),
    );
    expect(screen.getByRole("searchbox")).toHaveValue("");
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

    expect(screen.getByRole("searchbox")).toHaveValue("design");
  });

  it("passes the normalized mode to focused children", async () => {
    render(
      await BlogPage({
        searchParams: Promise.resolve({ q: " design ", tag: "Technology" }),
      }),
    );

    expect(screen.getByRole("searchbox")).toHaveValue("design");
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
      "[@media(max-height:500px)_and_(orientation:landscape)]:py-2",
      "md:top-[56px]",
    );
    expect(screen.getByTestId("blog-topics-sidebar")).toHaveClass(
      "xl:sticky",
      "xl:top-[138px]",
    );
    expect(screen.getByTestId("blog-filter-bar")).toHaveClass(
      "[@media(max-height:500px)_and_(orientation:landscape)]:flex-row",
      "sm:flex-row",
    );
    expect(container.querySelector("#blog-results")).toHaveClass(
      "scroll-mt-[236px]",
      "[@media(max-height:500px)_and_(orientation:landscape)]:scroll-mt-[96px]",
      "sm:scroll-mt-[168px]",
      "md:scroll-mt-[160px]",
    );
    const search = screen.getByRole("search");
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

  it("keeps the same focused search input when clearing navigates to All posts", async () => {
    const user = userEvent.setup();
    const view = render(
      await BlogPage({ searchParams: Promise.resolve({ q: "design" }) }),
    );
    const input = screen.getByRole("searchbox");
    await user.click(input);
    await user.clear(input);

    expect(push).toHaveBeenLastCalledWith("/blog#blog-results");
    view.rerender(await BlogPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("searchbox")).toBe(input);
    expect(input).toHaveFocus();
    await user.type(input, "photography");
    expect(input).toHaveValue("photography");
  });

  it("preserves replacement text entered before the clear navigation completes", async () => {
    const user = userEvent.setup();
    const view = render(
      await BlogPage({ searchParams: Promise.resolve({ q: "design" }) }),
    );
    const input = screen.getByRole("searchbox");
    await user.click(input);
    await user.clear(input);
    await user.type(input, "photography");

    view.rerender(await BlogPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("searchbox")).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("photography");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenLastCalledWith("/blog?q=photography#blog-results");
  });
});
