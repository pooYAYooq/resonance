/**
 * Component tests for the shared `PostCard`.
 *
 * Verifies the card renders core post metadata, links to the post detail
 * page, exposes the author row with a profile link, and uses `UserAvatar`
 * for the author image.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "./PostCard";
import type { Id } from "@/convex/_generated/dataModel";

vi.mock("../ui/avatar", () => ({
  Avatar: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-avatar className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ src, alt }: { src: string; alt: string }) => (
    <div
      data-avatar-img
      data-src={src}
      data-alt={alt}
      role="img"
      aria-label={alt}
    />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span data-avatar-fallback>{children}</span>
  ),
}));

vi.mock("./LikeButton", () => ({
  LikeButton: ({
    postId,
    isLiked,
    likeCount,
  }: {
    postId: string;
    isLiked: boolean;
    likeCount: number;
  }) => (
    <button
      aria-label={isLiked ? "Unlike this post" : "Like this post"}
      aria-pressed={isLiked}
      data-post-id={postId}
    >
      {likeCount}
    </button>
  ),
}));

vi.mock("./BookmarkButton", () => ({
  BookmarkButton: ({ postId }: { postId: string; size?: "sm" | "default" }) => (
    <button
      aria-label="Save to reading list"
      aria-pressed={false}
      data-post-id={postId}
    />
  ),
}));

const basePost = {
  postId: "post-123" as Id<"posts">,
  title: "Echoes in the Static",
  body: JSON.stringify({
    format: "blocknote@1",
    blocks: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "An exploration of hidden patterns in everyday noise and why resonance matters more than volume.",
          },
        ],
      },
    ],
  }),
  imageUrl: "https://example.com/cover.png",
  commentCount: 3,
  likeCount: 5,
  isLiked: false,
  createdAt: new Date("2026-06-01T12:00:00Z").getTime(),
  authorId: "user-abc",
  authorName: "Ada Lovelace",
  authorAvatarUrl: "https://example.com/ada.png",
};

const structuredBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: "A structured heading" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Readable styled content",
          styles: { bold: true },
        },
        {
          type: "link",
          href: "https://example.com",
          content: [{ type: "text", text: " with a link" }],
        },
      ],
    },
    {
      type: "bulletListItem",
      content: [{ type: "text", text: "A list item" }],
    },
  ],
});

describe("PostCard", () => {
  it("renders the post title", () => {
    render(<PostCard {...basePost} />);
    expect(
      screen.getByRole("heading", { name: "Echoes in the Static" }),
    ).toBeInTheDocument();
  });

  it("renders the body excerpt", () => {
    render(<PostCard {...basePost} />);
    expect(
      screen.getByText(/exploration of hidden patterns/i),
    ).toBeInTheDocument();
  });

  it("renders readable excerpts for structured bodies", () => {
    const { container } = render(
      <PostCard {...basePost} body={structuredBody} />,
    );
    const excerpt = container.querySelector("p.line-clamp-3");

    expect(excerpt).toHaveTextContent(
      "A structured heading Readable styled content with a link A list item",
    );
    expect(excerpt).toHaveClass("text-muted-foreground", "line-clamp-3");
    expect(excerpt).not.toHaveTextContent("format");
    expect(excerpt).not.toHaveTextContent("blocks");
    expect(excerpt).not.toHaveTextContent(/[{}\[\]"]+/);
  });

  it("renders an empty excerpt for malformed structured bodies without leaking JSON", () => {
    const malformed = JSON.stringify({
      format: "blocknote@1",
      blocks: [{ type: "image", props: { storageId: "secret-storage-id" } }],
    });
    const { container } = render(<PostCard {...basePost} body={malformed} />);
    const excerpt = container.querySelector("p.line-clamp-3");

    expect(excerpt).toBeInTheDocument();
    expect(excerpt?.textContent).toBe("");
    expect(excerpt).not.toHaveTextContent("secret-storage-id");
    expect(excerpt).not.toHaveTextContent(/[{}\[\]"]+/);
  });

  it("excerpts image captions but never alt text or storage IDs", () => {
    const body = JSON.stringify({
      format: "blocknote@1",
      blocks: [
        {
          type: "image",
          props: {
            storageId: "storage-secret-1",
            altText: "internal alt description",
            caption: "A readable caption",
          },
        },
      ],
    });
    const { container } = render(<PostCard {...basePost} body={body} />);
    const excerpt = container.querySelector("p.line-clamp-3");

    expect(excerpt?.textContent).toBe("A readable caption");
    expect(excerpt).not.toHaveTextContent("internal alt description");
    expect(excerpt).not.toHaveTextContent("storage-secret-1");
  });

  it("renders the comment count", () => {
    render(<PostCard {...basePost} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the comment count when there is one comment", () => {
    render(<PostCard {...basePost} commentCount={1} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("links the title to the post detail page", () => {
    render(<PostCard {...basePost} />);
    const heading = screen.getByRole("heading", {
      name: "Echoes in the Static",
    });
    const link = heading.closest("a");
    expect(link).toHaveAttribute("href", "/blog/post-123");
  });

  it("renders the formatted creation date in a time element", () => {
    render(<PostCard {...basePost} />);
    const time = screen.getByText("Jun 1, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute(
      "dateTime",
      new Date(basePost.createdAt).toISOString(),
    );
  });

  it("renders the cover image when imageUrl is provided", () => {
    const { container } = render(<PostCard {...basePost} />);
    const img = screen.getByAltText("Echoes in the Static");
    expect(img).toBeInTheDocument();
    // Next.js Image rewrites the src to the local optimization endpoint; verify
    // the original URL is preserved in the encoded query string.
    expect(img.getAttribute("src") ?? "").toContain("example.com%2Fcover.png");
    // The cover wrapper should use the consistent 16:9 aspect ratio.
    const coverWrapper = container.querySelector(".aspect-video");
    expect(coverWrapper).toBeInTheDocument();
  });

  it("the card has hover-lift classes", () => {
    const { container } = render(<PostCard {...basePost} />);
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toHaveClass("hover:-translate-y-0.5");
    expect(card).toHaveClass("hover:shadow-md");
  });

  it("falls back to a default cover image when imageUrl is null", () => {
    render(<PostCard {...basePost} imageUrl={null} />);
    const img = screen.getByAltText("Echoes in the Static");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBeTruthy();
  });

  it("renders the author name and links it to the profile page", () => {
    render(<PostCard {...basePost} />);
    const authorLink = screen.getByRole("link", { name: "Ada Lovelace" });
    expect(authorLink).toHaveAttribute("href", "/u/user-abc");
  });

  it("renders the author avatar via UserAvatar", () => {
    render(<PostCard {...basePost} />);
    expect(
      screen.getAllByRole("img", { name: "Ada Lovelace avatar" }),
    ).toHaveLength(1);
  });

  it("uses a default author name when authorName is null", () => {
    // Cast through unknown so the type system allows the null in tests.
    render(<PostCard {...basePost} authorName={null as unknown as string} />);
    const link = screen.getByRole("link", { name: /Unknown/i });
    expect(link).toHaveAttribute("href", "/u/user-abc");
  });

  it("includes a Read More link pointing to the post detail page", () => {
    render(<PostCard {...basePost} />);
    const readMore = screen.getByRole("link", { name: /read more/i });
    expect(readMore).toHaveAttribute("href", "/blog/post-123");
  });

  it("renders the like count", () => {
    render(<PostCard {...basePost} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders LikeButton", () => {
    render(<PostCard {...basePost} />);
    expect(
      screen.getByRole("button", { name: "Like this post" }),
    ).toBeInTheDocument();
  });

  it("renders LikeButton as liked when isLiked is true", () => {
    render(<PostCard {...basePost} isLiked={true} />);
    expect(
      screen.getByRole("button", { name: "Unlike this post" }),
    ).toBeInTheDocument();
  });

  it("renders linked tag pills and omits them when tags are missing", () => {
    const { rerender } = render(
      <PostCard {...basePost} tags={["Technology", "Design"]} />,
    );
    expect(screen.getByRole("link", { name: "Technology" })).toHaveAttribute(
      "href",
      "/blog?tag=Technology",
    );
    expect(screen.getByRole("link", { name: "Design" })).toBeInTheDocument();

    rerender(<PostCard {...basePost} />);
    expect(screen.queryByRole("link", { name: "Technology" })).toBeNull();

    rerender(<PostCard {...basePost} tags={[]} />);
    expect(screen.queryByRole("link", { name: "Technology" })).toBeNull();
  });
});
