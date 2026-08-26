/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
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
  it("stores a durable viewer key alongside a post unique-view counter", async () => {
    const t = convexTest(schema, modules);

    const { post, view } = await t.run(async (ctx) => {
      const post = await ctx.db.insert("posts", publishedPost);
      const view = await ctx.db.insert("postViews", {
        postId: post,
        viewerKey: "user:reader-1",
        createdAt: 2,
      });
      return { post, view };
    });

    await t.run(async (ctx) => {
      await expect(ctx.db.get(post)).resolves.toMatchObject({
        uniqueViewCount: 0,
      });
      await expect(ctx.db.get(view)).resolves.toMatchObject({
        postId: post,
        viewerKey: "user:reader-1",
        createdAt: 2,
      });
    });
  });
});
