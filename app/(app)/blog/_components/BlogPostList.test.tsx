import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { fetchQueryMock } = vi.hoisted(() => ({ fetchQueryMock: vi.fn() }));

vi.mock("convex/nextjs", () => ({ fetchQuery: fetchQueryMock }));
vi.mock("@/convex/_generated/api", () => ({
  api: { posts: { getPosts: "getPosts" } },
}));
vi.mock("@/components/web/PostCard", () => ({
  PostCard: ({ title }: { title: string }) => <article>{title}</article>,
}));

import { BlogPostList } from "./BlogPostList";

describe("BlogPostList", () => {
  beforeEach(() => fetchQueryMock.mockReset());

  it("drains source cursors for a tag-filtered page", async () => {
    fetchQueryMock
      .mockResolvedValueOnce({
        page: [],
        isDone: false,
        continueCursor: "next",
      })
      .mockResolvedValueOnce({
        page: [
          {
            _id: "post-1",
            title: "Tagged post",
            body: "Body",
            imageUrl: null,
            commentCount: 0,
            likeCount: 0,
            isLiked: false,
            createdAt: 1,
            authorId: "author-1",
            authorName: "Author",
            authorAvatarUrl: null,
            tags: ["Technology"],
          },
        ],
        isDone: true,
        continueCursor: "",
      });

    render(await BlogPostList({ tag: "Technology" }));

    expect(screen.getByText("Tagged post")).toBeInTheDocument();
    expect(fetchQueryMock).toHaveBeenNthCalledWith(1, "getPosts", {
      tag: "Technology",
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(fetchQueryMock).toHaveBeenCalledTimes(2);
    expect(fetchQueryMock).toHaveBeenNthCalledWith(2, "getPosts", {
      tag: "Technology",
      paginationOpts: { numItems: 50, cursor: "next" },
    });
  });

  it("renders a filtered empty state", async () => {
    fetchQueryMock.mockResolvedValue({
      page: [],
      isDone: true,
      continueCursor: "",
    });

    render(await BlogPostList({ tag: "Technology" }));
    expect(screen.getByText("No posts found")).toBeInTheDocument();
    expect(fetchQueryMock).toHaveBeenCalledWith("getPosts", {
      tag: "Technology",
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(screen.getByRole("link", { name: /clear filter/i })).toHaveAttribute(
      "href",
      "/blog",
    );
  });
});
