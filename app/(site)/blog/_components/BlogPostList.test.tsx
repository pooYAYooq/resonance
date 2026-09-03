import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { fetchAuthQueryMock } = vi.hoisted(() => ({
  fetchAuthQueryMock: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => ({ fetchAuthQuery: fetchAuthQueryMock }));
vi.mock("@/convex/_generated/api", () => ({
  api: { posts: { getPosts: "getPosts" } },
}));
vi.mock("@/components/web/PostCard", () => ({
  PostCard: ({ title }: { title: string }) => <article>{title}</article>,
}));

import { BlogPostList } from "./BlogPostList";

describe("BlogPostList", () => {
  beforeEach(() => fetchAuthQueryMock.mockReset());

  it("drains source cursors for a tag-filtered page", async () => {
    fetchAuthQueryMock
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
    expect(fetchAuthQueryMock).toHaveBeenNthCalledWith(1, "getPosts", {
      tag: "Technology",
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(fetchAuthQueryMock).toHaveBeenCalledTimes(2);
    expect(fetchAuthQueryMock).toHaveBeenNthCalledWith(2, "getPosts", {
      tag: "Technology",
      paginationOpts: { numItems: 50, cursor: "next" },
    });
  });

  it("renders a filtered empty state", async () => {
    fetchAuthQueryMock.mockResolvedValue({
      page: [],
      isDone: true,
      continueCursor: "",
    });

    render(await BlogPostList({ tag: "Technology" }));
    expect(screen.getByText("No posts found")).toBeInTheDocument();
    expect(fetchAuthQueryMock).toHaveBeenCalledWith("getPosts", {
      tag: "Technology",
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(screen.getByRole("link", { name: /clear filter/i })).toHaveAttribute(
      "href",
      "/blog",
    );
  });
});
