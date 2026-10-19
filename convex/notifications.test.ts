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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  applyMarkRead,
  applyReadBatch,
  FANOUT_BATCH_SIZE,
} from "./notifications";

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

  describe("markRead", () => {
    it("rejects markRead when unauthenticated", async () => {
      const t = convexTest(schema, modules);

      const notificationId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        return ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 1,
        });
      });

      await expect(
        t.mutation(api.notifications.markRead, { notificationId }),
      ).rejects.toThrow("Unauthorized");
    });

    it("marks an unread notification read and decrements the counter exactly once", async () => {
      const t = convexTest(schema, modules);
      const { notificationId } = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("users", {
          userId: "reader",
          displayName: "Reader",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
          unreadNotificationCount: 1,
          createdAt: 1,
        });
        await ctx.db.insert("users", {
          userId: "other",
          displayName: "Other",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
          unreadNotificationCount: 1,
          createdAt: 1,
        });
        await ctx.db.insert("notifications", {
          recipientId: "other",
          actorId: "author-1",
          postId,
          createdAt: 1,
        });
        const notificationId = await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 2,
        });
        return { notificationId };
      });

      await t.run(async (ctx) =>
        applyMarkRead(ctx, "reader", notificationId, 100),
      );
      await t.run(async (ctx) =>
        applyMarkRead(ctx, "reader", notificationId, 200),
      );

      const state = await t.run(async (ctx) => {
        const notification = await ctx.db.get(notificationId);
        const reader = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "reader"))
          .unique();
        const other = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "other"))
          .unique();
        const otherNotifications = await ctx.db
          .query("notifications")
          .withIndex("by_recipientId_and_createdAt", (q) =>
            q.eq("recipientId", "other"),
          )
          .unique();
        return {
          readAt: notification?.readAt,
          readerUnread: reader?.unreadNotificationCount,
          otherUnread: other?.unreadNotificationCount,
          otherReadAt: otherNotifications?.readAt,
        };
      });

      expect(state.readAt).toBe(100);
      expect(state.readerUnread).toBe(0);
      expect(state.otherUnread).toBe(1);
      expect(state.otherReadAt).toBeUndefined();
    });

    it("refuses a notification that belongs to another recipient", async () => {
      const t = convexTest(schema, modules);
      const notificationId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("users", {
          userId: "reader",
          displayName: "Reader",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
          unreadNotificationCount: 1,
          createdAt: 1,
        });
        return ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 1,
        });
      });

      await expect(
        t.run(async (ctx) =>
          applyMarkRead(ctx, "intruder", notificationId, 100),
        ),
      ).rejects.toThrow("Notification not found.");

      const state = await t.run(async (ctx) => {
        const notification = await ctx.db.get(notificationId);
        const reader = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "reader"))
          .unique();
        return {
          readAt: notification?.readAt,
          readerUnread: reader?.unreadNotificationCount,
        };
      });
      expect(state.readAt).toBeUndefined();
      expect(state.readerUnread).toBe(1);
    });

    it("refuses an id whose row no longer exists", async () => {
      const t = convexTest(schema, modules);
      const notificationId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        const id = await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 1,
        });
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        t.run(async (ctx) => applyMarkRead(ctx, "reader", notificationId, 100)),
      ).rejects.toThrow("Notification not found.");
    });

    it("refuses when the recipient's users row is missing", async () => {
      const t = convexTest(schema, modules);
      const notificationId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        return ctx.db.insert("notifications", {
          recipientId: "reader-without-profile",
          actorId: "author-1",
          postId,
          createdAt: 1,
        });
      });

      await expect(
        t.run(async (ctx) =>
          applyMarkRead(ctx, "reader-without-profile", notificationId, 100),
        ),
      ).rejects.toThrow("User not found.");

      const notification = await t.run(async (ctx) =>
        ctx.db.get(notificationId),
      );
      expect(notification?.readAt).toBeUndefined();
    });

    it("refuses an invalid counter without marking the row", async () => {
      const t = convexTest(schema, modules);
      const notificationId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("users", {
          userId: "reader",
          displayName: "Reader",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
          unreadNotificationCount: -1,
          createdAt: 1,
        });
        return ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 1,
        });
      });

      await expect(
        t.run(async (ctx) => applyMarkRead(ctx, "reader", notificationId, 100)),
      ).rejects.toThrow("Unread notification counter is invalid.");

      const state = await t.run(async (ctx) => {
        const notification = await ctx.db.get(notificationId);
        const reader = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "reader"))
          .unique();
        return {
          readAt: notification?.readAt,
          readerUnread: reader?.unreadNotificationCount,
        };
      });
      expect(state.readAt).toBeUndefined();
      expect(state.readerUnread).toBe(-1);
    });

    it("clamps an inconsistent zero counter without going negative", async () => {
      const t = convexTest(schema, modules);
      const notificationId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("users", {
          userId: "reader",
          displayName: "Reader",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
          unreadNotificationCount: 0,
          createdAt: 1,
        });
        return ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 1,
        });
      });

      await t.run(async (ctx) =>
        applyMarkRead(ctx, "reader", notificationId, 100),
      );

      const state = await t.run(async (ctx) => {
        const notification = await ctx.db.get(notificationId);
        const reader = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "reader"))
          .unique();
        return {
          readAt: notification?.readAt,
          readerUnread: reader?.unreadNotificationCount,
        };
      });
      expect(state.readAt).toBe(100);
      expect(state.readerUnread).toBe(0);
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
          uniqueViewCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        for (const followerId of ["follower-1", "follower-2", "follower-3"]) {
          await ctx.db.insert("users", {
            userId: followerId,
            displayName: followerId,
            followerCount: 0,
            followingCount: 0,
            publishedPostCount: 0,
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
      expect(recipientIds).toEqual(["follower-1", "follower-2", "follower-3"]);

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
          uniqueViewCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("users", {
          userId: "follower-1",
          displayName: "Follower",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
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
        return {
          notifications,
          unreadNotificationCount: user?.unreadNotificationCount,
        };
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
          uniqueViewCount: 0,
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
          uniqueViewCount: 0,
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
          uniqueViewCount: 0,
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
          uniqueViewCount: 0,
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

  describe("markReadBatch (internal)", () => {
    it("marks a bounded read snapshot idempotently without touching unrelated notifications", async () => {
      const t = convexTest(schema, modules);
      const ids = await t.run(async (ctx) => {
        const targetPostId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          publishedAt: 1,
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        const unrelatedPostId = await ctx.db.insert("posts", {
          title: "Unrelated",
          body: "Body",
          tags: [],
          authorId: "author-2",
          status: "published",
          publishedAt: 1,
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        for (let i = 0; i < 101; i++) {
          await ctx.db.insert("notifications", {
            recipientId: "reader",
            actorId: "author-1",
            postId: targetPostId,
            createdAt: i + 1,
          });
        }
        const unrelatedId = await ctx.db.insert("notifications", {
          recipientId: "other-reader",
          actorId: "author-2",
          postId: unrelatedPostId,
          createdAt: 1,
        });
        return { targetPostId, unrelatedId };
      });

      const args = {
        recipientId: "reader",
        readAt: 101,
        paginationOpts: { numItems: 100, cursor: null },
      };
      await t.mutation(internal.notifications.markReadBatch, args);
      await t.mutation(internal.notifications.markReadBatch, args);
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      const targetNotifications = await t.run(async (ctx) =>
        ctx.db
          .query("notifications")
          .withIndex("by_recipientId_and_createdAt", (q) =>
            q.eq("recipientId", "reader"),
          )
          .take(101),
      );
      expect(targetNotifications).toHaveLength(101);
      expect(
        targetNotifications.every(
          (notification) => notification.readAt === 101,
        ),
      ).toBe(true);
      await expect(
        t.run(async (ctx) => ctx.db.get(ids.unrelatedId)),
      ).resolves.not.toHaveProperty("readAt");
    });
  });

  describe("applyReadBatch", () => {
    it("marks the watermark page read and reconciles the counter when nothing is newer", async () => {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("users", {
          userId: "reader",
          displayName: "Reader",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
          unreadNotificationCount: 3,
          createdAt: 1,
        });
        await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 1,
        });
        await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 2,
          readAt: 1,
        });
        await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 3,
        });
      });

      const batchArgs = {
        recipientId: "reader",
        readAt: 5,
        paginationOpts: { numItems: 10, cursor: null },
      };
      await t.run(async (ctx) => applyReadBatch(ctx, batchArgs));
      await t.run(async (ctx) => applyReadBatch(ctx, batchArgs));

      const state = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "reader"))
          .unique();
        const rows = await ctx.db
          .query("notifications")
          .withIndex("by_recipientId_and_createdAt", (q) =>
            q.eq("recipientId", "reader"),
          )
          .take(10);
        return {
          unread: user?.unreadNotificationCount,
          readFlags: rows.map((row) => row.readAt),
        };
      });
      expect(state.unread).toBe(0);
      expect(state.readFlags).toEqual([5, 1, 5]);
    });

    it("does not clear a counter for arrivals after the watermark", async () => {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("users", {
          userId: "reader",
          displayName: "Reader",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
          unreadNotificationCount: 1,
          createdAt: 1,
        });
        await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 10,
        });
      });

      await t.run(async (ctx) =>
        applyReadBatch(ctx, {
          recipientId: "reader",
          readAt: 5,
          paginationOpts: { numItems: 10, cursor: null },
        }),
      );

      const state = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "reader"))
          .unique();
        const row = await ctx.db
          .query("notifications")
          .withIndex("by_recipientId_and_createdAt", (q) =>
            q.eq("recipientId", "reader"),
          )
          .unique();
        return { unread: user?.unreadNotificationCount, readAt: row?.readAt };
      });
      expect(state.unread).toBe(1);
      expect(state.readAt).toBeUndefined();
    });

    it("clears a stale counter when the watermark page is exhausted with nothing newer", async () => {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          userId: "reader",
          displayName: "Reader",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
          unreadNotificationCount: 3,
          createdAt: 1,
        });
      });

      await t.run(async (ctx) =>
        applyReadBatch(ctx, {
          recipientId: "reader",
          readAt: 5,
          paginationOpts: { numItems: 10, cursor: null },
        }),
      );

      const user = await t.run(async (ctx) =>
        ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "reader"))
          .unique(),
      );
      expect(user?.unreadNotificationCount).toBe(0);
    });

    it("leaves a new arrival counted when an old unprocessed row is opened before the continuation runs", async () => {
      const t = convexTest(schema, modules);
      const seed = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("users", {
          userId: "reader",
          displayName: "Reader",
          followerCount: 0,
          followingCount: 0,
          publishedPostCount: 0,
          unreadNotificationCount: 2,
          createdAt: 1,
        });
        const old1 = await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 1,
        });
        const old2 = await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId,
          createdAt: 2,
        });
        return { postId, old1, old2 };
      });

      // A bulk read starts: only the oldest row fits in the first batch.
      const first = await t.run(async (ctx) =>
        applyReadBatch(ctx, {
          recipientId: "reader",
          readAt: 5,
          paginationOpts: { numItems: 1, cursor: null },
        }),
      );
      expect(first.isDone).toBe(false);

      // A new notification arrives while the continuation is still pending.
      const newId = await t.run(async (ctx) => {
        const newId = await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          postId: seed.postId,
          createdAt: 10,
        });
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "reader"))
          .unique();
        await ctx.db.patch(user!._id, {
          unreadNotificationCount: (user!.unreadNotificationCount ?? 0) + 1,
        });
        return newId;
      });

      // The user opens an old row the first batch did not reach yet.
      await t.run(async (ctx) => applyMarkRead(ctx, "reader", seed.old2, 6));

      const continuation = await t.run(async (ctx) =>
        applyReadBatch(ctx, {
          recipientId: "reader",
          readAt: 5,
          paginationOpts: { numItems: 1, cursor: first.continueCursor },
        }),
      );
      expect(continuation.isDone).toBe(true);

      const state = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", "reader"))
          .unique();
        const newRow = await ctx.db.get(newId);
        const old1 = await ctx.db.get(seed.old1);
        const old2 = await ctx.db.get(seed.old2);
        return {
          unread: user?.unreadNotificationCount,
          newRowReadAt: newRow?.readAt,
          old1ReadAt: old1?.readAt,
          old2ReadAt: old2?.readAt,
        };
      });
      expect(state.unread).toBe(1);
      expect(state.newRowReadAt).toBeUndefined();
      expect(state.old1ReadAt).toBe(5);
      expect(state.old2ReadAt).toBe(6);
    });
  });
});
