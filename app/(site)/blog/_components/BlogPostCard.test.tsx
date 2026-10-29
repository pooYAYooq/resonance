import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlogPostCard } from "./BlogPostCard";

vi.mock("@/components/web/CoverImage", () => ({
  CoverImage: ({ alt, priority }: { alt: string; priority?: boolean }) => (
    <img alt={alt} data-priority={String(Boolean(priority))} />
  ),
}));

vi.mock("@/components/web/UserAvatar", () => ({
  UserAvatar: ({
    name,
    avatarUrl,
  }: {
    name: string;
    avatarUrl?: string | null;
  }) => (
    <span
      data-slot="avatar"
      data-avatar-url={avatarUrl ?? ""}
      aria-label={`${name} avatar`}
    />
  ),
}));

vi.mock("@/components/web/BookmarkButton", () => ({
  BookmarkButton: ({
    postTitle,
    presentation,
  }: {
    postTitle?: string;
    presentation?: string;
  }) => (
    <button
      aria-label={`Save “${postTitle}”`}
      data-presentation={presentation}
    />
  ),
}));

const post = {
  _id: "post-1" as never,
  title: "Readable title",
  bodyText: "A plain text excerpt",
  authorId: "author-1",
  authorName: "Ari",
  authorUsername: "ari",
  authorAvatarUrl: "https://cdn.example/ari.png",
  tags: ["Technology"],
  imageUrl: null,
  publishedAt: Date.UTC(2026, 0, 2),
  commentCount: 3,
  likeCount: 8,
};

describe("BlogPostCard", () => {
  it("renders the row, author, avatar, date, tag, and static engagement", () => {
    const { container } = render(<BlogPostCard post={post} />);

    expect(
      screen.getByRole("heading", { name: "Readable title" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("A plain text excerpt")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
    expect(screen.getByRole("link", { name: "Ari" })).toHaveAttribute(
      "href",
      "/u/ari",
    );
    expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    expect(screen.getByLabelText("Ari avatar")).toHaveAttribute(
      "data-avatar-url",
      "https://cdn.example/ari.png",
    );
    expect(screen.getByText("Jan 2, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Published/)).toBeNull();
    expect(screen.getByRole("link", { name: "Technology" })).toHaveAttribute(
      "href",
      "/blog?tag=Technology",
    );
    expect(screen.getByText("8 likes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /like/i })).toBeNull();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read" })).toBeInTheDocument();
  });

  it("uses a 16:9 cover and the uniform row layout", () => {
    const { container } = render(<BlogPostCard post={post} />);
    const card = container.querySelector('[data-slot="card"]');

    expect(card).toHaveClass(
      "gap-0",
      "p-0",
      "rounded-sm",
      "md:grid",
      "md:grid-cols-[2fr_3fr]",
    );
    expect(card).toHaveClass(
      "transition-colors",
      "motion-safe:transition-all",
      "motion-safe:hover:-translate-y-0.5",
      "hover:bg-muted/30",
    );
    expect(card).not.toHaveClass("gap-6", "py-6", "lg:grid-cols-[1fr_1fr]");
    const cover = screen.getByTestId("blog-card-cover");
    expect(cover).toHaveClass("aspect-video", "rounded-t-sm");
    expect(cover).toHaveClass(
      "md:aspect-auto",
      "md:rounded-l-sm",
      "md:rounded-tr-none",
    );
  });

  it("steps down long titles and clamps them", () => {
    render(<BlogPostCard post={{ ...post, title: "A".repeat(60) }} />);

    expect(screen.getByRole("heading", { level: 3 })).toHaveClass(
      "text-base",
      "line-clamp-2",
    );
  });

  it("renders the cover image when one exists", () => {
    const { container } = render(
      <BlogPostCard
        post={{ ...post, imageUrl: "https://cdn.example/cover.png" }}
        priority
      />,
    );

    expect(screen.getByAltText("Readable title")).toHaveAttribute(
      "data-priority",
      "true",
    );
    expect(screen.getByRole("button", { name: /save/i })).toHaveAttribute(
      "data-presentation",
      "icon",
    );
  });
});
