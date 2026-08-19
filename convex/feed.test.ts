/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import { FEED_BATCH_SIZE, FEED_WINDOW_MS } from "./feed";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: NOW,
        commentCount: 0,
        likeCount: 0,
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

describe("feed maintenance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fans out one row per current follower and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { postId, authorId } = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "New post",
        body: "Body",
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: now,
        commentCount: 0,
        likeCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      for (const followerId of ["reader-1", "reader-2"]) {
        await ctx.db.insert("follows", {
          followerId,
          followingId: "author-1",
          createdAt: now,
        });
      }
      return { postId, authorId: "author-1" };
    });

    const args = {
      postId,
      authorId,
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
      retryCount: 0,
    };
    await t.mutation(internal.feed.fanOutForPost, args);
    await t.mutation(internal.feed.fanOutForPost, args);

    const rows = await t.run(async (ctx) => ctx.db.query("feed").collect());
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.userId).sort()).toEqual([
      "reader-1",
      "reader-2",
    ]);
  });

  it("returns continuation metadata when the follower batch is full", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { postId } = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Popular post",
        body: "Body",
        tags: [],
        authorId: "popular-author",
        status: "published",
        publishedAt: now,
        commentCount: 0,
        likeCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      for (let index = 0; index < FEED_BATCH_SIZE + 1; index += 1) {
        await ctx.db.insert("follows", {
          followerId: `reader-${index}`,
          followingId: "popular-author",
          createdAt: now + index,
        });
      }
      return { postId };
    });

    const result = await t.mutation(internal.feed.fanOutForPost, {
      postId,
      authorId: "popular-author",
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
      retryCount: 0,
    });

    expect(result).toEqual({ done: false, processed: FEED_BATCH_SIZE });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  it("does not fan out a published post without a publication timestamp", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Missing publication time",
        body: "Body",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("follows", {
        followerId: "reader-1",
        followingId: "author-1",
        createdAt: now,
      });
      return postId;
    });

    const result = await t.mutation(internal.feed.fanOutForPost, {
      postId,
      authorId: "author-1",
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
      retryCount: 0,
    });

    expect(result).toEqual({ done: true, processed: 0 });
    await expect(
      t.run(async (ctx) => ctx.db.query("feed").collect()),
    ).resolves.toEqual([]);
  });

  it("backfills only recent posts and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { followId } = await t.run(async (ctx) => {
      const followId = await ctx.db.insert("follows", {
        followerId: "reader-1",
        followingId: "author-1",
        createdAt: now,
      });
      await ctx.db.insert("posts", {
        title: "Recent",
        body: "Body",
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: now - FEED_WINDOW_MS + 1,
        commentCount: 0,
        likeCount: 0,
        createdAt: now - FEED_WINDOW_MS + 1,
        updatedAt: now - FEED_WINDOW_MS + 1,
      });
      await ctx.db.insert("posts", {
        title: "Expired",
        body: "Body",
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: now - FEED_WINDOW_MS - 1,
        commentCount: 0,
        likeCount: 0,
        createdAt: now - FEED_WINDOW_MS - 1,
        updatedAt: now - FEED_WINDOW_MS - 1,
      });
      return { followId };
    });

    const args = {
      userId: "reader-1",
      authorId: "author-1",
      followId,
      cutoffAt: now - FEED_WINDOW_MS,
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
    };
    await t.mutation(internal.feed.backfillForFollow, args);
    await t.mutation(internal.feed.backfillForFollow, args);

    const rows = await t.run(async (ctx) => ctx.db.query("feed").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("reader-1");
    expect(rows[0].authorId).toBe("author-1");
  });

  it("backfills a post published recently even when its draft is old", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { followId } = await t.run(async (ctx) => {
      const followId = await ctx.db.insert("follows", {
        followerId: "reader-1",
        followingId: "author-1",
        createdAt: now,
      });
      await ctx.db.insert("posts", {
        title: "Old draft, new publication",
        body: "Body",
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: now - 1,
        commentCount: 0,
        likeCount: 0,
        createdAt: now - FEED_WINDOW_MS - 1,
        updatedAt: now,
      });
      return { followId };
    });

    await t.mutation(internal.feed.backfillForFollow, {
      userId: "reader-1",
      authorId: "author-1",
      followId,
      cutoffAt: now - FEED_WINDOW_MS,
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
    });

    const rows = await t.run(async (ctx) => ctx.db.query("feed").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].createdAt).toBe(now - 1);
  });

  it("deletes only rows for the reader, author, and exact follow generation", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { followId, otherFollowId, postIds } = await t.run(async (ctx) => {
      const followId = await ctx.db.insert("follows", {
        followerId: "reader-1",
        followingId: "author-1",
        createdAt: now,
      });
      const otherFollowId = await ctx.db.insert("follows", {
        followerId: "reader-2",
        followingId: "author-1",
        createdAt: now,
      });
      const otherAuthorFollowId = await ctx.db.insert("follows", {
        followerId: "reader-1",
        followingId: "author-2",
        createdAt: now,
      });
      const postIds = await Promise.all(
        ["author-1", "author-2", "author-1"].map((authorId) =>
          ctx.db.insert("posts", {
            title: authorId,
            body: "Body",
            tags: [],
            authorId,
            status: "published",
            commentCount: 0,
            likeCount: 0,
            createdAt: now,
            updatedAt: now,
          }),
        ),
      );
      await ctx.db.insert("feed", {
        userId: "reader-1",
        postId: postIds[0],
        authorId: "author-1",
        followId,
        createdAt: now,
        insertedAt: now,
      });
      await ctx.db.insert("feed", {
        userId: "reader-2",
        postId: postIds[0],
        authorId: "author-1",
        followId: otherFollowId,
        createdAt: now,
        insertedAt: now,
      });
      await ctx.db.insert("feed", {
        userId: "reader-1",
        postId: postIds[1],
        authorId: "author-2",
        followId: otherAuthorFollowId,
        createdAt: now,
        insertedAt: now,
      });
      await ctx.db.insert("feed", {
        userId: "reader-1",
        postId: postIds[2],
        authorId: "author-1",
        followId: otherAuthorFollowId,
        createdAt: now,
        insertedAt: now,
      });
      return { followId, otherFollowId, postIds };
    });

    await t.mutation(internal.feed.deleteForUnfollow, {
      userId: "reader-1",
      authorId: "author-1",
      followId,
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
    });

    const remaining = await t.run(async (ctx) => ctx.db.query("feed").collect());
    expect(remaining).toHaveLength(3);
    expect(
      remaining.some(
        (row) => row.userId === "reader-1" && row.postId === postIds[0],
      ),
    ).toBe(false);
    expect(remaining.some((row) => row.followId === otherFollowId)).toBe(true);
  });

  it("removes expired and dangling rows and drains cleanup continuations", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const followId = await ctx.db.insert("follows", {
        followerId: "reader-1",
        followingId: "author-1",
        createdAt: now,
      });
      const recentPostId = await ctx.db.insert("posts", {
        title: "Recent",
        body: "Body",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      const expiredPostId = await ctx.db.insert("posts", {
        title: "Expired",
        body: "Body",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        createdAt: now - FEED_WINDOW_MS - 1,
        updatedAt: now - FEED_WINDOW_MS - 1,
      });
      const danglingPostId = await ctx.db.insert("posts", {
        title: "Dangling",
        body: "Body",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("feed", {
        userId: "reader-1",
        postId: recentPostId,
        authorId: "author-1",
        followId,
        createdAt: now,
        insertedAt: now,
      });
      await ctx.db.insert("feed", {
        userId: "reader-1",
        postId: expiredPostId,
        authorId: "author-1",
        followId,
        createdAt: now - FEED_WINDOW_MS - 1,
        insertedAt: now,
      });
      await ctx.db.insert("feed", {
        userId: "reader-1",
        postId: danglingPostId,
        authorId: "author-1",
        followId,
        createdAt: now,
        insertedAt: now,
      });
      await ctx.db.delete(danglingPostId);
    });

    await t.mutation(internal.feed.cleanupExpired, {
      cutoffAt: now - FEED_WINDOW_MS,
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
    });

    await t.mutation(internal.feed.cleanupExpired, {
      cutoffAt: now - FEED_WINDOW_MS,
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
    });

    const remaining = await t.run(async (ctx) => ctx.db.query("feed").collect());
    expect(remaining).toHaveLength(1);
    expect(remaining[0].createdAt).toBe(now);
  });
});
