/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import { describe, expect, it } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_700_000_000_000;

describe("feed schema", () => {
  it("stores feed rows for different readers pointing to the same post", async () => {
    const t = convexTest(schema, modules);

    const rows = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Feed post",
        body: "Body",
        authorId: "author-1",
        commentCount: 0,
        createdAt: 100,
        updatedAt: 100,
      });
      const followIds = await Promise.all(
        ["reader-1", "reader-2"].map((followerId) =>
          ctx.db.insert("follows", {
            followerId,
            followingId: "author-1",
            createdAt: 100,
          }),
        ),
      );

      await ctx.db.insert("feed", {
        userId: "reader-1",
        postId,
        authorId: "author-1",
        followId: followIds[0],
        createdAt: 100,
        insertedAt: 101,
      });
      await ctx.db.insert("feed", {
        userId: "reader-2",
        postId,
        authorId: "author-1",
        followId: followIds[1],
        createdAt: 100,
        insertedAt: 102,
      });

      return {
        byReader: await ctx.db
          .query("feed")
          .withIndex("by_userId_and_postId", (q) =>
            q.eq("userId", "reader-1").eq("postId", postId),
          )
          .collect(),
        byChronology: await ctx.db
          .query("feed")
          .withIndex("by_userId_and_createdAt_and_insertedAt_and_postId", (q) =>
            q.eq("userId", "reader-1"),
          )
          .collect(),
        byFollowGeneration: await ctx.db
          .query("feed")
          .withIndex("by_userId_and_authorId_and_followId_and_createdAt", (q) =>
            q.eq("userId", "reader-1").eq("authorId", "author-1"),
          )
          .collect(),
      };
    });

    expect(rows.byReader).toHaveLength(1);
    expect(rows.byChronology).toHaveLength(1);
    expect(rows.byFollowGeneration).toHaveLength(1);
  });
});

describe("feed query", () => {
  it("returns an empty completed page without auth", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.feed.getFeed, {
      asOf: NOW,
      paginationOpts: {
        numItems: 20,
        maximumRowsRead: 20,
        cursor: null,
      },
    });

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });

  it("rejects an unbounded page contract", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.query(api.feed.getFeed, {
        asOf: NOW,
        paginationOpts: {
          numItems: 21,
          maximumRowsRead: 21,
          cursor: null,
        },
      }),
    ).rejects.toThrow("Feed pages must request exactly 20 rows");
  });
});
