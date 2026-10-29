import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostEngagement } from "./PostEngagement";

vi.mock("./LikeButton", () => ({
  LikeButton: ({
    postTitle,
    isLiked,
    likeCount,
  }: {
    postTitle?: string;
    isLiked: boolean;
    likeCount: number;
  }) => (
    <button
      aria-label={isLiked ? `Unlike “${postTitle}”` : `Like “${postTitle}”`}
      aria-pressed={isLiked}
    >
      {likeCount}
    </button>
  ),
}));
vi.mock("./BookmarkButton", () => ({
  BookmarkButton: ({
    postTitle,
    isBookmarked,
    presentation,
  }: {
    postTitle?: string;
    isBookmarked: boolean;
    presentation?: string;
  }) => (
    <button
      aria-label={
        isBookmarked
          ? `Remove “${postTitle}” from Saved`
          : `Save “${postTitle}”`
      }
      aria-pressed={isBookmarked}
      data-presentation={presentation}
    />
  ),
}));

const base = {
  postId: "post-1" as never,
  postTitle: "A post",
  commentCount: 3,
  likeCount: 8,
  isLiked: false,
  isBookmarked: false,
};

describe("PostEngagement", () => {
  it("renders the feed actions with their labels and states", () => {
    render(<PostEngagement {...base} />);

    expect(screen.getByRole("group", { name: "Engagement" })).toHaveTextContent(
      "3",
    );
    expect(screen.getByText("3 comments")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Like “A post”" }),
    ).toHaveAttribute("aria-pressed", "false");
    const save = screen.getByRole("button", { name: "Save “A post”" });
    expect(save).toHaveAttribute("aria-pressed", "false");
    expect(save).toHaveAttribute("data-presentation", "compact");
  });

  it("renders a static like count without a like button", () => {
    render(<PostEngagement {...base} showLikeButton={false} />);

    expect(screen.queryByRole("button", { name: /like/i })).toBeNull();
    expect(screen.getByText("8 likes")).toBeInTheDocument();
  });

  it("can omit save", () => {
    render(<PostEngagement {...base} showSave={false} />);

    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  it("can omit comments and the static like count", () => {
    render(
      <PostEngagement
        {...base}
        showComments={false}
        showLikeButton={false}
        showLikeCount={false}
      />,
    );

    expect(screen.queryByText(/comments/)).toBeNull();
    expect(screen.queryByText(/likes/)).toBeNull();
    expect(screen.queryByRole("button", { name: /like/i })).toBeNull();
  });

  it("forwards the Blog icon save presentation", () => {
    render(<PostEngagement {...base} savePresentation="icon" />);

    expect(
      screen.getByRole("button", { name: "Save “A post”" }),
    ).toHaveAttribute("data-presentation", "icon");
  });
});
