/**
 * Unit tests for Convex notifications queries and mutations.
 *
 * Auth-path tests (fan-out row inserts, getNotifications auth-then-
 * paginate, markAllRead reset) are limited because convex-test cannot
 * mock the Better Auth component that `safeGetAuthUser` walks
 * (`convex/users.test.ts:1-7`, `convex/follows.test.ts:1-11`). These
 * are covered by manual testing and code inspection of
 * `notifications.ts`. Here we cover:
 *
 *  - The unauthenticated rejection path for `markAllRead`.
 *  - The no-auth query short-circuits for `getUnreadCount` and
 *    `getNotifications` (return 0 / empty page, do NOT throw).
 *  - The `fanOutForPost` internal mutation: inserts one
 *    `notifications` row per follower, bumps the denormalized
 *    counter on each recipient's `users` doc, and self-schedules a
 *    continuation when a batch is full (verified via
 *    convex-test's `finishAllScheduledFunctions(vi.runAllTimers)`).
 *
 * The `getNotifications` auth-paginated hydration path is covered by
 * manual testing; the no-auth empty-page behavior is the
 * client-mount-safety contract.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { FANOUT_BATCH_SIZE } from "./notifications";

const modules = import.meta.glob("./**/*.ts");

describe("notifications functions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("markAllRead", () => {
    it("rejects markAllRead when unauthenticated", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(api.notifications.markAllRead, {}),
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("getUnreadCount", () => {
    it("returns 0 when unauthenticated", async () => {
      const t = convexTest(schema, modules);

      const result = await t.query(api.notifications.getUnreadCount, {});
      expect(result).toBe(0);
    });

  });

  describe("getNotifications", () => {
    it("returns an empty done page when unauthenticated", async () => {
      const t = convexTest(schema, modules);

      const result = await t.query(api.notifications.getNotifications, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toEqual([]);
      expect(result.isDone).toBe(true);
    });
  });

  describe("fanOutForPost (internal)", () => {
    it("inserts one notification per follower and bumps each recipient's counter", async () => {
      const t = convexTest(schema, modules);

      const { postId, authorId } = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "New post",
          body: "Body.",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        for (const followerId of ["follower-1", "follower-2", "follower-3"]) {
          await ctx.db.insert("users", {
            userId: followerId,
            displayName: followerId,
            followerCount: 0,
            followingCount: 0,
            unreadNotificationCount: 0,
            createdAt: Date.now(),
          });
          await ctx.db.insert("follows", {
            followerId,
            followingId: "author-1",
            createdAt: Date.now(),
          });
        }
        return { postId, authorId: "author-1" };
      });

      const result = await t.mutation(internal.notifications.fanOutForPost, {
        postId,
        authorId,
        paginationOpts: { numItems: 200, cursor: null },
      });
      expect(result).toEqual({ done: true, processed: 3 });

      const notifications = await t.run(async (ctx) =>
        ctx.db.query("notifications").collect(),
      );
      expect(notifications).toHaveLength(3);
      expect(
        notifications.every(
          (n) => n.postId === postId && n.actorId === "author-1",
        ),
      ).toBe(true);
      const recipientIds = notifications.map((n) => n.recipientId).sort();
      expect(recipientIds).toEqual([
        "follower-1",
        "follower-2",
        "follower-3",
      ]);

      const counters = await t.run(async (ctx) => {
        const out: Record<string, number> = {};
        for (const id of ["follower-1", "follower-2", "follower-3"]) {
          const u = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", id))
            .unique();
          out[id] = u?.unreadNotificationCount ?? 0;
        }
        return out;
      });
      expect(counters).toEqual({
        "follower-1": 1,
        "follower-2": 1,
        "follower-3": 1,
      });
    });

    it("does not duplicate notifications or unread counts when retried", async () => {
      const t = convexTest(schema, modules);

      const { postId } = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Retried post",
          body: "Body.",
          tags: [],
          authorId: "author-1",
          status: "published",
          publishedAt: Date.now(),
          commentCount: 0,
          likeCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("users", {
          userId: "follower-1",
          displayName: "Follower",
          followerCount: 0,
          followingCount: 0,
          unreadNotificationCount: 0,
          createdAt: Date.now(),
        });
        await ctx.db.insert("follows", {
          followerId: "follower-1",
          followingId: "author-1",
          createdAt: Date.now(),
        });
        return { postId };
      });

      const args = {
        postId,
        authorId: "author-1",
        paginationOpts: { numItems: FANOUT_BATCH_SIZE, cursor: null },
      };
      await t.mutation(internal.notifications.fanOutForPost, args);
      await t.mutation(internal.notifications.fanOutForPost, args);

      const state = await t.run(async (ctx) => {
        const notifications = await ctx.db.query("notifications").collect();
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "follower-1"))
          .unique();
        return { notifications, unreadNotificationCount: user?.unreadNotificationCount };
      });

      expect(state.notifications).toHaveLength(1);
      expect(state.unreadNotificationCount).toBe(1);
    });

    it("does not fan out a draft post", async () => {
      const t = convexTest(schema, modules);

      const postId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Draft post",
          body: "Body.",
          tags: [],
          authorId: "author-1",
          status: "draft",
          commentCount: 0,
          likeCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("follows", {
          followerId: "follower-1",
          followingId: "author-1",
          createdAt: Date.now(),
        });
        return postId;
      });

      const result = await t.mutation(internal.notifications.fanOutForPost, {
        postId,
        authorId: "author-1",
        paginationOpts: { numItems: FANOUT_BATCH_SIZE, cursor: null },
      });

      expect(result).toEqual({ done: true, processed: 0 });
      await expect(
        t.run(async (ctx) => ctx.db.query("notifications").collect()),
      ).resolves.toEqual([]);
    });

    it("inserts a notification even when the recipient's users doc is missing (AuthSync race)", async () => {
      const t = convexTest(schema, modules);

      const { postId, authorId } = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "New post",
          body: "Body.",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("follows", {
          followerId: "follower-racy",
          followingId: "author-1",
          createdAt: Date.now(),
        });
        return { postId, authorId: "author-1" };
      });

      const result = await t.mutation(internal.notifications.fanOutForPost, {
        postId,
        authorId,
        paginationOpts: { numItems: 200, cursor: null },
      });
      expect(result).toEqual({ done: true, processed: 1 });

      const notifications = await t.run(async (ctx) =>
        ctx.db.query("notifications").collect(),
      );
      expect(notifications).toHaveLength(1);
      expect(notifications[0].recipientId).toBe("follower-racy");
    });

    it("schedules a continuation when the batch is full, processing the remaining rows on resume", async () => {
      const t = convexTest(schema, modules);

      const { postId, authorId } = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Big-fanout post",
          body: "Body.",
          tags: [],
          authorId: "popular-author",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const lastTs = Date.now();
        for (let i = 0; i < 201; i++) {
          await ctx.db.insert("follows", {
            followerId: `follower-${i}`,
            followingId: "popular-author",
            createdAt: lastTs + i,
          });
        }
        return { postId, authorId: "popular-author" };
      });

      const first = await t.mutation(internal.notifications.fanOutForPost, {
        postId,
        authorId,
        paginationOpts: { numItems: 200, cursor: null },
      });
      expect(first).toEqual({ done: false, processed: 200 });

      await t.finishAllScheduledFunctions(vi.runAllTimers);

      const notifications = await t.run(async (ctx) =>
        ctx.db.query("notifications").collect(),
      );
      expect(notifications).toHaveLength(201);
      const recipientIds = new Set(notifications.map((n) => n.recipientId));
      expect(recipientIds.size).toBe(201);
    });

    it("returns done: true and processes all rows in a single batch when followers fit", async () => {
      const t = convexTest(schema, modules);

      const { postId, authorId } = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Small-fanout post",
          body: "Body.",
          tags: [],
          authorId: "small-author",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        for (let i = 0; i < 5; i++) {
          await ctx.db.insert("follows", {
            followerId: `follower-${i}`,
            followingId: "small-author",
            createdAt: Date.now() + i,
          });
        }
        return { postId, authorId: "small-author" };
      });

      const result = await t.mutation(internal.notifications.fanOutForPost, {
        postId,
        authorId,
        paginationOpts: { numItems: 200, cursor: null },
      });
      expect(result).toEqual({ done: true, processed: 5 });
    });
  });
});
