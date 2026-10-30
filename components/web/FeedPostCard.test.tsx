import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedPostCard } from "./FeedPostCard";

vi.mock("./LikeButton", () => ({
  LikeButton: ({ likeCount }: { likeCount: number }) => (
    <button aria-label="Like this post">{likeCount}</button>
  ),
}));
vi.mock("./BookmarkButton", () => ({
  BookmarkButton: () => <button aria-label="Save this post" />,
}));

const base = {
  postId: "post-1" as never,
  title: "A readable feed post",
  imageUrl: null,
  commentCount: 3,
  likeCount: 8,
  isLiked: false,
  isBookmarked: false,
  publishedAt: Date.UTC(2026, 9, 30, 10, 0, 0),
  authorId: "author-1",
  authorName: "Ari",
  authorUsername: "ari",
  authorAvatarUrl: null,
  tags: ["Technology"],
  now: Date.UTC(2026, 9, 30, 12, 0, 0),
};

describe("FeedPostCard", () => {
  it("renders the author, relative date, title, tag, and actions", () => {
    const { container } = render(<FeedPostCard {...base} />);

    expect(screen.getByRole("link", { name: "Ari" })).toHaveAttribute(
      "href",
      "/u/ari",
    );
    expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "A readable feed post" }),
    ).toHaveAttribute("href", "/blog/post-1");
    expect(
      screen.getByRole("heading", { name: "A readable feed post" }),
    ).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
    expect(screen.getByText("3 comments")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Technology" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /like/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read" })).toBeInTheDocument();
  });

  it("uses the same horizontal row for every card", () => {
    const { container } = render(<FeedPostCard {...base} />);
    const card = container.querySelector('[data-slot="card"]');

    expect(card).toHaveClass(
      "lg:grid",
      "lg:grid-cols-2",
      "xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
      "rounded-sm",
      "max-md:rounded-none",
      "max-md:bg-transparent",
      "max-md:shadow-none",
      "max-md:ring-0",
    );
    expect(card).not.toHaveClass("md:grid");
    const cover = screen.getByTestId("post-card-cover");
    expect(cover).toHaveClass(
      "aspect-[3/2]",
      "rounded-t-sm",
      "max-md:rounded-none",
    );
    expect(cover).toHaveClass(
      "lg:aspect-auto",
      "lg:rounded-l-sm",
      "lg:rounded-tr-none",
    );
  });

  it("uses the large title scale for short titles", () => {
    render(<FeedPostCard {...base} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("text-lg");
  });

  it("clamps long titles and steps down the size", () => {
    render(<FeedPostCard {...base} title={"A".repeat(60)} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveClass(
      "line-clamp-2",
      "text-base",
    );
  });

  it("sizes the row cover for its 40% column", () => {
    const { container } = render(
      <FeedPostCard {...base} imageUrl="https://cdn.example/cover.png" />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "sizes",
      "(min-width: 1024px) 30vw, 100vw",
    );
  });

  it("uses the motion-safe hover lift", () => {
    const { container } = render(<FeedPostCard {...base} />);

    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "md:motion-safe:hover:-translate-y-0.5",
    );
  });
});
