import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import BlogPage from "./page";

vi.mock("@/components/web/AuthCTA", () => ({
  AuthCTA: () => <div data-testid="auth-cta" />,
}));
const { blogFilter, blogPostList } = vi.hoisted(() => ({
  blogFilter: vi.fn(() => null),
  blogPostList: vi.fn(() => <div data-testid="blog-post-list" />),
}));
vi.mock("./_components/BlogFilter", () => ({
  BlogFilter: blogFilter,
}));
vi.mock("./_components/BlogPostList", () => ({
  BlogPostList: blogPostList,
}));

describe("BlogPage", () => {
  beforeEach(() => {
    blogFilter.mockClear();
    blogPostList.mockClear();
  });

  it("passes topic mode to focused children", async () => {
    render(
      await BlogPage({ searchParams: Promise.resolve({ tag: "Technology" }) }),
    );
    expect(blogFilter).toHaveBeenLastCalledWith(
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

    expect(blogFilter).toHaveBeenLastCalledWith(
      { mode: { mode: "topic", tag: "Technology" } },
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

    expect(blogFilter).toHaveBeenLastCalledWith(
      { mode: { mode: "search", query: "design" } },
      undefined,
    );
  });

  it("passes the normalized mode to focused children", async () => {
    render(
      await BlogPage({
        searchParams: Promise.resolve({ q: " design ", tag: "Technology" }),
      }),
    );

    expect(blogFilter).toHaveBeenLastCalledWith(
      { mode: { mode: "search", query: "design" } },
      undefined,
    );
    expect(blogPostList).toHaveBeenLastCalledWith(
      { mode: { mode: "search", query: "design" } },
      undefined,
    );
  });
});
