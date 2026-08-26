import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";

const { fetchQueryMock, postViewTrackerMock } = vi.hoisted(() => ({
  fetchQueryMock: vi.fn(),
  postViewTrackerMock: vi.fn(() => null),
}));

vi.mock("convex/nextjs", () => ({ fetchQuery: fetchQueryMock }));
vi.mock("@/components/web/CommentSection", () => ({
  CommentSection: () => null,
}));
vi.mock("@/components/web/LikeButton", () => ({ LikeButton: () => null }));
vi.mock("@/components/web/BookmarkButton", () => ({
  BookmarkButton: () => null,
}));
vi.mock("@/components/web/PostBody", () => ({
  PostBody: () => null,
}));
vi.mock("@/components/web/PostViewTracker", () => ({
  PostViewTracker: postViewTrackerMock,
}));
vi.mock("next/image", () => ({
  default: () => null,
}));

import PostIdRoute, { generateMetadata } from "./page";

const postId = "post-1" as Id<"posts">;
const params = Promise.resolve({ postId });

const basePost = {
  _id: postId,
  title: "Structured Post",
  imageUrl: null,
  inlineImages: [],
  isLiked: false,
  commentCount: 0,
  likeCount: 0,
  createdAt: 1,
  updatedAt: 1,
  publishedAt: 1,
  authorId: "user-1",
  tags: [],
};

describe("blog post generateMetadata", () => {
  beforeEach(() => {
    fetchQueryMock.mockReset();
  });

  it("builds the description from readable structured text", async () => {
    fetchQueryMock.mockResolvedValue({
      ...basePost,
      body: JSON.stringify({
        format: "blocknote@1",
        blocks: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Readable excerpt text for metadata." },
            ],
          },
          {
            type: "image",
            props: {
              storageId: "storage-secret-1",
              altText: "internal alt description",
            },
          },
        ],
      }),
    });

    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe("Structured Post");
    expect(metadata.description).toContain("Readable excerpt text");
    expect(metadata.description).not.toContain("blocknote@1");
    expect(metadata.description).not.toContain("storage-secret-1");
    expect(metadata.description).not.toContain("internal alt description");
    expect(metadata.description).not.toMatch(/[{}\[\]"]+/);
    expect(metadata.openGraph?.description).toBe(metadata.description);
  });

  it("uses an empty description for a non-canonical body", async () => {
    fetchQueryMock.mockResolvedValue({
      ...basePost,
       body: "A non-canonical body for metadata.",
    });

    const metadata = await generateMetadata({ params });

    expect(metadata.description).toBe("");
  });

  it("falls back to an empty description for malformed structured bodies", async () => {
    fetchQueryMock.mockResolvedValue({
      ...basePost,
      body: JSON.stringify({
        format: "blocknote@1",
        blocks: [{ type: "image", props: { storageId: "secret" } }],
      }),
    });

    const metadata = await generateMetadata({ params });

    expect(metadata.description).toBe("");
  });

  it("returns a not-found title when the post is missing", async () => {
    fetchQueryMock.mockResolvedValue(null);

    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe("Post Not Found");
  });
});

describe("blog post timestamps", () => {
  beforeEach(() => {
    fetchQueryMock.mockReset();
    postViewTrackerMock.mockClear();
  });

  it("shows the publication date and omits Updated when the post is unchanged", async () => {
    fetchQueryMock.mockResolvedValue({
      ...basePost,
      createdAt: Date.UTC(2023, 0, 1),
      publishedAt: Date.UTC(2024, 0, 15),
      updatedAt: Date.UTC(2024, 0, 15),
      body: "body",
    });

    render(await PostIdRoute({ params }));

    expect(screen.getByText("Published on: January 15, 2024")).toBeInTheDocument();
    expect(screen.queryByText(/Updated on:/)).toBeNull();
  });

  it("shows the last-edited date when updatedAt is after publishedAt", async () => {
    fetchQueryMock.mockResolvedValue({
      ...basePost,
      createdAt: Date.UTC(2023, 0, 1),
      publishedAt: Date.UTC(2024, 0, 15),
      updatedAt: Date.UTC(2024, 1, 20),
      body: "body",
    });

    render(await PostIdRoute({ params }));

    expect(screen.getByText("Published on: January 15, 2024")).toBeInTheDocument();
    expect(screen.getByText("Updated on: February 20, 2024")).toBeInTheDocument();
  });

  it("does not fall back to createdAt when publishedAt is missing", async () => {
    fetchQueryMock.mockResolvedValue({
      ...basePost,
      createdAt: Date.UTC(2023, 0, 1),
      publishedAt: undefined,
      body: "body",
    });

    render(await PostIdRoute({ params }));

    expect(screen.getByText("Post not found")).toBeInTheDocument();
    expect(screen.queryByText(/Published on:/)).toBeNull();
    expect(postViewTrackerMock).not.toHaveBeenCalled();
  });

  it("tracks the resolved ID for a successfully rendered published post", async () => {
    fetchQueryMock.mockResolvedValue({ ...basePost, body: "body" });

    render(await PostIdRoute({ params }));

    expect(postViewTrackerMock).toHaveBeenCalledWith({ postId }, undefined);
  });
});
