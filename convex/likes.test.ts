/**
 * Unit tests for Convex likes queries and mutations.
 * Covers auth rejection and unauthenticated isLiked behavior.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import * as likes from "./likes";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("likes functions", () => {
  it("getLikedPosts returns an empty completed page when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.likes.getLikedPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result).toEqual({ page: [], isDone: true, continueCursor: "" });
  });

  it("returns one viewer's published likes newest first", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const olderPostId = await ctx.db.insert("posts", {
        title: "Older liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
      const newerPostId = await ctx.db.insert("posts", {
        title: "Newer liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("likes", {
        postId: olderPostId,
        userId: "viewer-1",
        createdAt: 100,
      });
      await ctx.db.insert("likes", {
        postId: newerPostId,
        userId: "viewer-1",
        createdAt: 200,
      });
    });

    const result = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 10, cursor: null },
        viewerId: "viewer-1",
      }),
    );

    expect(result.page.map((post) => post.title)).toEqual([
      "Newer liked post",
      "Older liked post",
    ]);
  });

  it("preserves the source cursor when the newest like points to a draft", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const publishedPostId = await ctx.db.insert("posts", {
        title: "Older published liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const draftPostId = await ctx.db.insert("posts", {
        title: "Newest draft liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
      await ctx.db.insert("likes", {
        postId: publishedPostId,
        userId: "viewer-1",
        createdAt: 100,
      });
      await ctx.db.insert("likes", {
        postId: draftPostId,
        userId: "viewer-1",
        createdAt: 200,
      });
    });

    const firstPage = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 1, cursor: null },
        viewerId: "viewer-1",
      }),
    );

    expect(firstPage.page).toEqual([]);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.continueCursor).not.toBe("");

    const secondPage = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 1, cursor: firstPage.continueCursor },
        viewerId: "viewer-1",
      }),
    );

    expect(secondPage.page.map((post) => post.title)).toEqual([
      "Older published liked post",
    ]);
    expect(secondPage.isDone).toBe(true);
  });

  it("skips draft and missing liked posts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const publishedPostId = await ctx.db.insert("posts", {
        title: "Published liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const draftPostId = await ctx.db.insert("posts", {
        title: "Draft liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
      const deletedPostId = await ctx.db.insert("posts", {
        title: "Deleted liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 3,
        updatedAt: 3,
      });
      await ctx.db.delete(deletedPostId);
      await ctx.db.insert("likes", {
        postId: publishedPostId,
        userId: "viewer-1",
        createdAt: 100,
      });
      await ctx.db.insert("likes", {
        postId: draftPostId,
        userId: "viewer-1",
        createdAt: 200,
      });
      await ctx.db.insert("likes", {
        postId: deletedPostId,
        userId: "viewer-1",
        createdAt: 300,
      });
    });

    const result = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 10, cursor: null },
        viewerId: "viewer-1",
      }),
    );

    expect(result.page.map((post) => post.title)).toEqual([
      "Published liked post",
    ]);
  });

  it("never returns another viewer's likes", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const firstPostId = await ctx.db.insert("posts", {
        title: "First viewer's liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const secondPostId = await ctx.db.insert("posts", {
        title: "Second viewer's liked post",
        body: "Body.",
        tags: [],
        authorId: "author-2",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
      await ctx.db.insert("likes", {
        postId: firstPostId,
        userId: "viewer-1",
        createdAt: 100,
      });
      await ctx.db.insert("likes", {
        postId: secondPostId,
        userId: "viewer-2",
        createdAt: 200,
      });
    });

    const result = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 10, cursor: null },
        viewerId: "viewer-1",
      }),
    );

    expect(result.page.map((post) => post.title)).toEqual([
      "First viewer's liked post",
    ]);
  });

  it("rejects toggleLike when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "Like target",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(t.mutation(api.likes.toggleLike, { postId })).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("rejects toggleCommentLike when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const { commentId } = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Post",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const id = await ctx.db.insert("comments", {
        postId,
        authorId: "user-2",
        authorName: "Alice",
        body: "Nice post.",
        likeCount: 0,
        createdAt: Date.now(),
      });
      return { commentId: id };
    });

    await expect(
      t.mutation(api.likes.toggleCommentLike, { commentId }),
    ).rejects.toThrow("Unauthorized");
  });

  it("getPostById returns isLiked: false for unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Liked post",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("likes", {
        postId: id,
        userId: "user-1",
        createdAt: Date.now(),
      });
      return id;
    });

    const result = await t.query(api.posts.getPostById, { postId });
    expect(result).not.toBeNull();
    expect(result?.isLiked).toBe(false);
  });

  it("getPosts returns isLiked: false for unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Liked post",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("likes", {
        postId: id,
        userId: "user-1",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page.length).toBeGreaterThan(0);
    for (const post of result.page) {
      expect(post.isLiked).toBe(false);
    }
  });

  it("getPostsByAuthorId returns isLiked: false for unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Liked post",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("likes", {
        postId: id,
        userId: "user-1",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "user-1",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page.length).toBeGreaterThan(0);
    for (const post of result.page) {
      expect(post.isLiked).toBe(false);
    }
  });
});
