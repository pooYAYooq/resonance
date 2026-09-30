import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";

const { fetchQueryMock, fetchAuthQueryMock, postViewTrackerMock } = vi.hoisted(
  () => ({
    fetchQueryMock: vi.fn(),
    fetchAuthQueryMock: vi.fn(),
    postViewTrackerMock: vi.fn(() => null),
  }),
);

vi.mock("convex/nextjs", () => ({ fetchQuery: fetchQueryMock }));
vi.mock("@/lib/auth-server", () => ({ fetchAuthQuery: fetchAuthQueryMock }));
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
  isBookmarked: false,
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
    fetchAuthQueryMock.mockReset();
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
              url: "storage-secret-1",
              name: "internal file name",
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
    expect(metadata.description).not.toContain("internal file name");
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
    fetchAuthQueryMock.mockReset();
    postViewTrackerMock.mockClear();
  });

  it("shows the publication date and omits Updated when the post is unchanged", async () => {
    fetchAuthQueryMock.mockResolvedValue({
      ...basePost,
      createdAt: Date.UTC(2023, 0, 1),
      publishedAt: Date.UTC(2024, 0, 15),
      updatedAt: Date.UTC(2024, 0, 15),
      body: "body",
    });

    render(await PostIdRoute({ params }));

    expect(
      screen.getByText("Published on: January 15, 2024"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Updated on:/)).toBeNull();
  });

  it("shows the last-edited date when updatedAt is after publishedAt", async () => {
    fetchAuthQueryMock.mockResolvedValue({
      ...basePost,
      createdAt: Date.UTC(2023, 0, 1),
      publishedAt: Date.UTC(2024, 0, 15),
      updatedAt: Date.UTC(2024, 1, 20),
      body: "body",
    });

    render(await PostIdRoute({ params }));

    expect(
      screen.getByText("Published on: January 15, 2024"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Updated on: February 20, 2024"),
    ).toBeInTheDocument();
  });

  it("does not fall back to createdAt when publishedAt is missing", async () => {
    fetchAuthQueryMock.mockResolvedValue({
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
    fetchAuthQueryMock.mockResolvedValue({ ...basePost, body: "body" });

    render(await PostIdRoute({ params }));

    expect(postViewTrackerMock).toHaveBeenCalledWith({ postId }, undefined);
  });

  it("uses the published 16:9 ratio for the reader cover", async () => {
    fetchAuthQueryMock.mockResolvedValue({ ...basePost, body: "body" });

    render(await PostIdRoute({ params }));

    expect(screen.getByTestId("default-cover").parentElement).toHaveClass(
      "aspect-[16/9]",
    );
  });

  it("lets the cover span the layout container and holds the prose at 700", async () => {
    fetchAuthQueryMock.mockResolvedValue({ ...basePost, body: "body" });

    render(await PostIdRoute({ params }));

    const frame = screen.getByTestId("reader-frame");
    expect(frame).toHaveClass("w-full");
    expect(frame.className).not.toMatch(/\bmax-w-/);
    const prose = screen.getByTestId("reader-prose");
    expect(prose).toHaveClass("max-w-[700px]");
    expect(prose).toHaveClass("mx-auto");
    expect(prose).toHaveClass("xl:mx-0");
    expect(frame).toContainElement(prose);
  });

  it("spans the top divider across the frame and keeps the rest in the prose column", async () => {
    fetchAuthQueryMock.mockResolvedValue({ ...basePost, body: "body" });

    const { container } = render(await PostIdRoute({ params }));

    const dividers = container.querySelectorAll<HTMLElement>(
      '[data-slot="separator"]',
    );
    expect(dividers).toHaveLength(2);
    const [topDivider, closingDivider] = Array.from(dividers);
    const frame = screen.getByTestId("reader-frame");
    const prose = screen.getByTestId("reader-prose");

    expect(prose).not.toContainElement(topDivider);
    expect(frame).toContainElement(topDivider);
    expect(prose).toContainElement(closingDivider);
  });

  it("keeps the cover and the title inside the frame", async () => {
    fetchAuthQueryMock.mockResolvedValue({ ...basePost, body: "body" });

    render(await PostIdRoute({ params }));

    const frame = screen.getByTestId("reader-frame");
    expect(frame).toContainElement(
      screen.getByTestId("default-cover").parentElement,
    );
    expect(frame).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Structured Post" }),
    );
  });

  it("holds the top of the page to a 24px rhythm", async () => {
    fetchAuthQueryMock.mockResolvedValue({ ...basePost, body: "body" });

    render(await PostIdRoute({ params }));

    const frame = screen.getByTestId("reader-frame");
    expect(frame).toHaveClass("pt-6");
    expect(frame.className).not.toMatch(/\bpy-8/);
    const cover = screen.getByTestId("default-cover").parentElement;
    expect(cover?.className).not.toMatch(/\bmt-/);
    expect(
      screen.getByRole("heading", { level: 1, name: "Structured Post" }),
    ).toHaveClass("mt-6");
  });

  it("does not put a return link above the cover", async () => {
    fetchAuthQueryMock.mockResolvedValue({ ...basePost, body: "body" });

    render(await PostIdRoute({ params }));

    expect(
      screen.queryByRole("link", { name: /back to blog page/i }),
    ).toBeNull();
  });

  it("offers a quiet return link at the end of the article", async () => {
    fetchAuthQueryMock.mockResolvedValue({ ...basePost, body: "body" });

    render(await PostIdRoute({ params }));

    const back = screen.getByRole("link", { name: /back to all posts/i });
    expect(back).toHaveAttribute("href", "/blog");
    expect(screen.getByTestId("reader-prose")).toContainElement(back);
  });

  it("renders the not-found fallback as part of the reader family", async () => {
    fetchAuthQueryMock.mockResolvedValue(null);

    render(await PostIdRoute({ params }));

    const frame = screen.getByTestId("not-found-frame");
    expect(frame).toHaveClass("w-full");
    expect(frame).toHaveClass("pt-6");
    expect(
      screen.getByRole("heading", { level: 1, name: "Post not found" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /back to all posts/i }),
    ).toHaveAttribute("href", "/blog");
  });
});
