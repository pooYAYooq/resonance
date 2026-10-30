import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";

vi.mock("./UserAvatar", () => ({
  UserAvatar: ({ name }: { name: string }) => (
    <span data-testid="author-avatar" aria-label={`${name} avatar`} />
  ),
}));

vi.mock("./CoverImage", () => ({
  CoverImage: ({ src }: { src?: string | null; alt: string }) => (
    <div data-testid="cover-image" data-src={src ?? undefined} />
  ),
}));

vi.mock("./LikeButton", () => ({
  LikeButton: ({
    postTitle,
    isLiked,
  }: {
    postTitle?: string;
    isLiked: boolean;
  }) => (
    <button
      type="button"
      data-testid="like-action"
      aria-label={isLiked ? `Unlike “${postTitle}”` : `Like “${postTitle}”`}
      aria-pressed={isLiked}
    />
  ),
}));

vi.mock("./BookmarkButton", () => ({
  BookmarkButton: ({
    postTitle,
    isBookmarked,
  }: {
    postTitle?: string;
    isBookmarked: boolean;
  }) => (
    <button
      type="button"
      data-testid="bookmark-action"
      aria-label={
        isBookmarked
          ? `Remove “${postTitle}” from Saved`
          : `Save “${postTitle}”`
      }
      aria-pressed={isBookmarked}
    />
  ),
}));

import { CollectionPostCard } from "./CollectionPostCard";

const basePost = {
  postId: "post-123" as Id<"posts">,
  title: "Echoes in the Static",
  imageUrl: "https://example.com/cover.png",
  commentCount: 2,
  likeCount: 4,
  isLiked: false,
  isBookmarked: true,
  authorId: "user-abc",
  authorName: "Ada Lovelace",
  authorUsername: "ada",
  authorAvatarUrl: null,
  tags: ["Design", "Photography", "Software", "Tutorial", "Culture"],
};

function getCard(container: HTMLElement): HTMLElement {
  const card = container.querySelector<HTMLElement>('[data-slot="card"]');
  if (!card) throw new Error("Collection card not found");
  return card;
}

describe("CollectionPostCard", () => {
  it("uses the small radius on the desktop card and a flat mobile row", () => {
    const { container } = render(
      <CollectionPostCard {...basePost} collection="saved" />,
    );

    expect(getCard(container)).toHaveClass("rounded-none", "sm:rounded-sm");
  });

  it("keeps the cover first and the byline directly after the title", () => {
    const { container } = render(
      <CollectionPostCard {...basePost} collection="saved" />,
    );
    const card = getCard(container);
    const cover = card.children[0] as HTMLElement;
    const content = card.children[1] as HTMLElement;
    const title = within(content).getByRole("heading", {
      level: 3,
      name: "Echoes in the Static",
    });
    const author = within(content).getByRole("link", {
      name: "Ada Lovelace",
    });

    expect(cover).toHaveClass(
      "col-start-1",
      "row-start-1",
      "aspect-[3/2]",
      "w-[96px]",
      "sm:w-28",
    );
    expect(cover).not.toHaveClass("h-16", "w-16");
    expect(content).toHaveClass("col-start-2", "row-start-1");
    expect(title).toBeInTheDocument();
    expect(author).toHaveAttribute("href", "/u/ada");
    expect(
      title.compareDocumentPosition(author) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(content).getByTestId("author-avatar")).toHaveAttribute(
      "aria-label",
      "Ada Lovelace avatar",
    );
  });

  it("renders the author-selected tags after the byline in a full-width row", () => {
    const { container } = render(
      <CollectionPostCard {...basePost} collection="liked" />,
    );
    const card = getCard(container);
    const content = card.children[1] as HTMLElement;
    const tagRow = card.children[2] as HTMLElement;
    const author = within(content).getByRole("link", {
      name: "Ada Lovelace",
    });
    const tags = within(tagRow).getAllByRole("link");

    expect(tagRow).toHaveClass(
      "col-span-2",
      "row-start-2",
      "hidden",
      "sm:flex",
    );
    expect(tags.map((tag) => tag.textContent)).toEqual(basePost.tags);
    expect(tags[0]).toHaveAttribute("href", "/blog?tag=Design");
    expect(
      author.compareDocumentPosition(tagRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(card.lastElementChild).toBe(tagRow);
  });

  it("does not render a tag row when the author selected no tags", () => {
    const { container } = render(
      <CollectionPostCard {...basePost} collection="saved" tags={[]} />,
    );
    const card = getCard(container);

    expect(card.children).toHaveLength(2);
    expect(card.querySelectorAll('a[href^="/blog?tag="]')).toHaveLength(0);
  });

  it("does not render a saved or liked timestamp", () => {
    const { container } = render(
      <CollectionPostCard {...basePost} collection="saved" />,
    );
    const card = getCard(container);

    expect(card.querySelector("time")).toBeNull();
    expect(card).not.toHaveTextContent(/Oct|2026|Saved on|Liked on/);
  });

  it.each([
    {
      collection: "saved" as const,
      action: "bookmark-action",
      other: "like-action",
      label: /Remove .* from Saved/,
      isLiked: false,
      isBookmarked: true,
    },
    {
      collection: "liked" as const,
      action: "like-action",
      other: "bookmark-action",
      label: /Unlike/,
      isLiked: true,
      isBookmarked: false,
    },
  ])(
    "renders only the $collection collection action",
    ({ collection, action, other, label, isLiked, isBookmarked }) => {
      const { container } = render(
        <CollectionPostCard
          {...basePost}
          collection={collection}
          isLiked={isLiked}
          isBookmarked={isBookmarked}
        />,
      );
      const card = getCard(container);
      const actionButton = screen.getByTestId(action);

      expect(actionButton).toHaveAttribute(
        "aria-label",
        expect.stringMatching(label),
      );
      expect(actionButton).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByTestId(other)).not.toBeInTheDocument();
      expect(card.querySelectorAll("button[aria-pressed]")).toHaveLength(1);
    },
  );

  it("uses the shared row hover treatment", () => {
    const { container } = render(
      <CollectionPostCard {...basePost} collection="saved" />,
    );

    expect(getCard(container)).toHaveClass(
      "sm:transition-colors",
      "sm:hover:bg-muted/50",
      "sm:focus-within:bg-muted/50",
    );
  });
});
