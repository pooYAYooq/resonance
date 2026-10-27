/** Tests for private bookmark queries and mutations, including authenticated hydration. */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { register } from "@convex-dev/better-auth/test";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createAuthenticatedTestUser(
  t: ReturnType<typeof convexTest>,
  email: string,
) {
  register(t);
  return await t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Viewer",
          email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            userId: user._id,
            token: `session-${email}`,
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
}

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

describe("saved collection timestamps", () => {
  it("returns save times in source order across missing and unpublished posts", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "saved@example.com");
    await t.run(async (ctx) => {
      for (const [title, createdAt, savedAt, status] of [
        ["Older save", 20, 100, "published"],
        ["Newer save", 10, 200, "published"],
        ["Draft", 30, 300, "draft"],
        ["Deleted", 40, 400, "published"],
      ] as const) {
        const postId = await ctx.db.insert("posts", {
          title,
          body: "Body",
          tags: [],
          authorId: "author",
          status,
          commentCount: 0,
          likeCount: 0,
          createdAt,
          updatedAt: createdAt,
        });
        await ctx.db.insert("bookmarks", {
          userId: identity.subject,
          postId,
          createdAt: savedAt,
        });
        if (title === "Deleted") await ctx.db.delete(postId);
      }
      const otherPost = await ctx.db.insert("posts", {
        title: "Other viewer",
        body: "Body",
        tags: [],
        authorId: "author",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        createdAt: 50,
        updatedAt: 50,
      });
      await ctx.db.insert("bookmarks", {
        userId: "other",
        postId: otherPost,
        createdAt: 500,
      });
    });
    const viewer = t.withIdentity(identity);
    const skipped = await viewer.query(api.bookmarks.getBookmarkedPosts, {
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(skipped.page).toEqual([]);
    expect(skipped.isDone).toBe(false);
    const result = await viewer.query(api.bookmarks.getBookmarkedPosts, {
      paginationOpts: { numItems: 2, cursor: skipped.continueCursor },
    });
    expect(
      result.page.map((post) => ({ title: post.title, addedAt: post.addedAt })),
    ).toEqual([
      { title: "Newer save", addedAt: 200 },
      { title: "Older save", addedAt: 100 },
    ]);
    expect(result.isDone).toBe(true);
  });
});
