/**
 * Unit tests for Convex bookmarks queries and mutations.
 *
 * Auth-path tests (toggleBookmark insert/delete, getBookmarkedPosts
 * enumeration, dangling-skip) are omitted because convex-test cannot
 * mock the Better Auth component that `safeGetAuthUser` walks
 * (`convex/users.test.ts:1-7`, `convex/likes.test.ts`). These are
 * covered by manual testing and code inspection of `bookmarks.ts`.
 * Here we cover the unauthenticated rejection / fail-soft paths
 * and the no-auth query behavior, matching the precedent in
 * `follows.test.ts`.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("bookmarks functions", () => {
  it("rejects toggleBookmark when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "Bookmark target",
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

    await expect(
      t.mutation(api.bookmarks.toggleBookmark, { postId }),
    ).rejects.toThrow("Unauthorized");
  });

  it("isBookmarked returns false when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
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
    });

    const result = await t.query(api.bookmarks.isBookmarked, { postId });
    expect(result).toBe(false);
  });

  it("isBookmarked returns false when a bookmark row exists but belongs to someone else and the caller is unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
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
      await ctx.db.insert("bookmarks", {
        userId: "someone-else",
        postId: id,
        createdAt: Date.now(),
      });
      return id;
    });

    const result = await t.query(api.bookmarks.isBookmarked, { postId });
    expect(result).toBe(false);
  });

  it("getBookmarkedPosts returns an empty page when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.bookmarks.getBookmarkedPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });
});
