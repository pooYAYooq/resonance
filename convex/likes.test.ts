/**
 * Unit tests for Convex likes queries and mutations.
 * Covers auth rejection and unauthenticated isLiked behavior.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("likes functions", () => {
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
