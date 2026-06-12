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
  }) => <div data-avatar className={className}>{children}</div>,
  AvatarImage: ({ src, alt }: { src: string; alt: string }) => (
    <div data-avatar-img data-src={src} data-alt={alt} role="img" aria-label={alt} />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span data-avatar-fallback>{children}</span>
  ),
}));

const basePost = {
  postId: "post-123" as Id<"posts">,
  title: "Echoes in the Static",
  body: "An exploration of hidden patterns in everyday noise and why resonance matters more than volume.",
  imageUrl: "https://example.com/cover.png",
  commentCount: 3,
  createdAt: new Date("2026-06-01T12:00:00Z").getTime(),
  authorId: "user-abc",
  authorName: "Ada Lovelace",
  authorAvatarUrl: "https://example.com/ada.png",
};

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

  it("renders the comment count with the plural form", () => {
    render(<PostCard {...basePost} />);
    expect(screen.getByText(/3\s*comments/)).toBeInTheDocument();
  });

  it("renders the comment count with the singular form when there is one comment", () => {
    render(<PostCard {...basePost} commentCount={1} />);
    expect(screen.getByText(/1\s*comment\b/)).toBeInTheDocument();
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
    expect(screen.getAllByRole("img", { name: "Ada Lovelace avatar" })).toHaveLength(1);
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
});
