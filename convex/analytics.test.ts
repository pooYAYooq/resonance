/**
 * Analytics tests cover pure and transaction helpers plus unauthenticated
 * public paths. Authenticated Better Auth component calls cannot be mocked by
 * convex-test, so they require manual verification.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import {
  getUtcDayStart,
  recordUniqueViewInTransaction,
  requireCurrentUser,
} from "./analytics";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const publishedPost = {
  title: "Published",
  body: "Body.",
  tags: [],
  authorId: "author-1",
  status: "published" as const,
  publishedAt: 1,
  commentCount: 0,
  likeCount: 0,
  uniqueViewCount: 0,
  createdAt: 1,
  updatedAt: 1,
};

describe("analytics storage contracts", () => {
  it("gets the UTC start for an analytics timestamp", () => {
    expect(getUtcDayStart(Date.UTC(2026, 7, 26, 19, 30))).toBe(
      Date.UTC(2026, 7, 26),
    );
  });

  it("records a viewer only once and increments post and author totals", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", publishedPost);
    });

    await t.run(async (ctx) => {
      const post = await ctx.db.get(postId);
      if (!post) throw new Error("Missing seeded post");

      await expect(
        recordUniqueViewInTransaction(ctx, post, "user:reader-1"),
      ).resolves.toBe(true);
      await expect(
        recordUniqueViewInTransaction(ctx, post, "user:reader-1"),
      ).resolves.toBe(false);

      const views = await ctx.db
        .query("postViews")
        .withIndex("by_postId_and_viewerKey", (q) =>
          q.eq("postId", postId).eq("viewerKey", "user:reader-1"),
        )
        .take(2);
      expect(views).toHaveLength(1);
      await expect(ctx.db.get(postId)).resolves.toMatchObject({
        uniqueViewCount: 1,
      });
      await expect(
        ctx.db
          .query("authorAnalytics")
          .withIndex("by_authorId", (q) => q.eq("authorId", "author-1"))
          .unique(),
      ).resolves.toMatchObject({
        uniqueViews: 1,
      });
    });
  });

  it("reports an auth-sync race when the authenticated user record is missing", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await expect(requireCurrentUser(ctx, "author-1")).rejects.toThrow(
        "User not found.",
      );
    });
  });

  it("rejects recordView and returns no summary when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", publishedPost),
    );

    await expect(
      t.mutation(api.analytics.recordView, { postId }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      t.query(api.analytics.getSummary, { asOf: Date.UTC(2026, 7, 26) }),
    ).resolves.toBeNull();
  });
});
