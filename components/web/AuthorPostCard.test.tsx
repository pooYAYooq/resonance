/**
 * Component tests for `AuthorPostCard`.
 *
 * The card is the only interactive surface of the showcase, so these tests pin
 * the single-anchor contract, the 3:2 cover frame, the like-count accessible
 * name, and the recoverable cover error (a sibling retry, no nested control).
 */

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { AuthorPostCard, type AuthorCard } from "./AuthorPostCard";

const post: AuthorCard = {
  postId: "post-1",
  title: "A quiet header",
  imageUrl: "https://cdn.example/cover.png",
  likeCount: 128,
};

describe("AuthorPostCard", () => {
  it("renders one link whose accessible name is the title", () => {
    const { container } = render(<AuthorPostCard post={post} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/blog/post-1");
    expect(links[0]).toHaveAccessibleName("A quiet header");
    expect(screen.getByText("A quiet header")).toBeInTheDocument();

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
  });

  it("keeps a 3:2 cover frame and an accessible like count", () => {
    render(<AuthorPostCard post={post} />);

    expect(screen.getByTestId("author-card-cover")).toHaveClass("aspect-[3/2]");
    const likes = screen.getByLabelText("128 likes");
    expect(likes).toHaveTextContent("128");
  });

  it("sizes the image for the showcase's third-width desktop grid by default", () => {
    const { container } = render(<AuthorPostCard post={post} />);

    expect(container.querySelector("img")).toHaveAttribute(
      "sizes",
      "(min-width: 768px) 33vw, 100vw",
    );
  });

  it("applies a caller-supplied sizes value instead of the showcase default", () => {
    const sizes =
      "(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";
    const { container } = render(<AuthorPostCard post={post} sizes={sizes} />);

    expect(container.querySelector("img")).toHaveAttribute("sizes", sizes);
  });

  it("always pluralizes the like label to match the approved copy", () => {
    render(<AuthorPostCard post={{ ...post, likeCount: 1 }} />);

    expect(screen.getByLabelText("1 likes")).toBeInTheDocument();
  });

  it("shows a sibling recovery with retry when the cover fails, keeping the link", () => {
    const { container } = render(<AuthorPostCard post={post} />);
    const link = screen.getByRole("link");

    fireEvent.error(container.querySelector("img")!);

    expect(screen.getByText("Cover unavailable")).toBeInTheDocument();
    const retry = screen.getByRole("button", {
      name: "Retry cover for A quiet header",
    });
    expect(link.contains(retry)).toBe(false);
    expect(link).toHaveAttribute("href", "/blog/post-1");
    expect(link).toHaveAccessibleName("A quiet header");
  });

  it("retries the cover, resetting the error and remounting the image", () => {
    const { container } = render(<AuthorPostCard post={post} />);
    fireEvent.error(container.querySelector("img")!);

    fireEvent.click(screen.getByRole("button", { name: /retry cover/i }));

    expect(screen.queryByText("Cover unavailable")).toBeNull();
    expect(container.querySelector("img")).toBeTruthy();
  });

  it("renders a blank cover and no recovery when there is no image", () => {
    const { container } = render(
      <AuthorPostCard post={{ ...post, imageUrl: null }} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("Cover unavailable")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByTestId("author-card-cover")).toHaveClass("aspect-[3/2]");
    expect(
      screen.getByRole("link", { name: "A quiet header" }),
    ).toHaveAttribute("href", "/blog/post-1");
  });

  it("clears a prior failure when the image URL changes", () => {
    const { container, rerender } = render(<AuthorPostCard post={post} />);
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText("Cover unavailable")).toBeInTheDocument();

    rerender(
      <AuthorPostCard
        post={{ ...post, imageUrl: "https://cdn.example/other.png" }}
      />,
    );

    expect(screen.queryByText("Cover unavailable")).toBeNull();
    expect(container.querySelector("img")).toBeTruthy();
  });

  it("renders the featured layout with a defined card boundary", () => {
    render(<AuthorPostCard post={post} featured />);

    const cover = screen.getByTestId("author-card-cover");
    const card = cover.closest('[data-slot="card"]');
    expect(card).toHaveAttribute("data-featured", "true");
    expect(card).toHaveClass("rounded-xl", "bg-card", "ring-1");
    expect(cover).toHaveClass("sm:aspect-auto");
    expect(cover).toHaveClass("sm:h-full");
  });

  it("keeps the single-link contract in featured mode", () => {
    render(<AuthorPostCard post={post} featured />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("A quiet header");
    expect(links[0]).toHaveAttribute("href", "/blog/post-1");
  });

  it("uses the feature image sizes by default", () => {
    const { container } = render(<AuthorPostCard post={post} featured />);

    expect(container.querySelector("img")).toHaveAttribute(
      "sizes",
      "(min-width: 1024px) 66vw, 100vw",
    );
  });

  it("gives the featured cover a responsive minimum height", () => {
    render(<AuthorPostCard post={post} featured />);

    const cover = screen.getByTestId("author-card-cover");
    expect(cover).toHaveClass("sm:min-h-[14rem]");
    expect(cover).toHaveClass("md:min-h-[16rem]");
    expect(cover).toHaveClass("lg:min-h-[18rem]");
  });

  it("wraps long unbroken titles inside the card", () => {
    render(<AuthorPostCard post={{ ...post, title: "A".repeat(120) }} />);

    expect(screen.getByRole("heading", { level: 3 })).toHaveClass("break-words");
  });

  it("wraps long unbroken titles in featured mode", () => {
    render(
      <AuthorPostCard
        post={{ ...post, title: "A".repeat(120) }}
        featured
      />,
    );

    expect(screen.getByRole("heading", { level: 3 })).toHaveClass("break-words");
  });

  it("keeps the cover hover transform motion-safe", () => {
    const { container } = render(<AuthorPostCard post={post} />);

    expect(container.querySelector("img")).toHaveClass(
      "motion-safe:group-hover:scale-[1.035]",
    );
  });

  it("keeps the featured cover hover transform motion-safe", () => {
    const { container } = render(<AuthorPostCard post={post} featured />);

    expect(container.querySelector("img")).toHaveClass(
      "motion-safe:group-hover:scale-[1.035]",
    );
  });

  it("keeps the retry control outside the link in featured mode", () => {
    const { container } = render(<AuthorPostCard post={post} featured />);
    const link = screen.getByRole("link");

    fireEvent.error(container.querySelector("img")!);

    const retry = screen.getByRole("button", {
      name: "Retry cover for A quiet header",
    });
    expect(link.contains(retry)).toBe(false);
    expect(link).toHaveAccessibleName("A quiet header");
  });
});
