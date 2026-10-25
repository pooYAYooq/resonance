/**
 * Unit tests for Convex notifications queries and mutations.
 *
 * Auth-path tests use the local Better Auth fixture from
 * `likes.test.ts`: `register(t)` wires the component, then the helper
 * creates a user and session that `safeGetAuthUser` can resolve. Here
 * we cover:
 *
 *  - The unauthenticated rejection path for `markAllRead`.
 *  - The no-auth query short-circuits for `getUnreadCount` and
 *    `getNotifications` (return 0 / empty page, do NOT throw).
 *  - The bounded read transition helpers (`applyMarkRead`,
 *    `applyReadBatch`) and `markReadBatch` continuations.
 *  - The authenticated `getNotifications` hydration path.
 *
 * The no-auth empty-page behavior is the client-mount-safety contract.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register } from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import {
  applyMarkRead,
  applyReadBatch,
  READ_RETENTION_MS,
} from "./notifications";

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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
          postId,
          createdAt: 1,
        });
        const notificationId = await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
            type: "post_like",
            dedupeKey: `post_like:${targetPostId}`,
            postId: targetPostId,
            createdAt: i + 1,
          });
        }
        const unrelatedId = await ctx.db.insert("notifications", {
          recipientId: "other-reader",
          actorId: "author-2",
          type: "post_like",
          dedupeKey: `post_like:${unrelatedPostId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
          postId,
          createdAt: 1,
        });
        await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
          postId,
          createdAt: 2,
          readAt: 1,
        });
        await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
          postId,
          createdAt: 1,
        });
        const old2 = await ctx.db.insert("notifications", {
          recipientId: "reader",
          actorId: "author-1",
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
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
          type: "post_like",
          dedupeKey: `post_like:${seed.postId}`,
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

  it("returns mixed row types newest first and keeps follow rows", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "reader@example.com");
    const { postId, commentId } = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 1,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      await ctx.db.insert("users", {
        userId: "actor-1",
        displayName: "Actor",
        username: "actor",
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      const postId = await ctx.db.insert("posts", {
        title: "A post",
        body: "Body.",
        tags: [],
        authorId: identity.subject,
        status: "published",
        commentCount: 1,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const commentId = await ctx.db.insert("comments", {
        postId,
        authorId: identity.subject,
        authorName: "Reader",
        body: "  a   long   comment  ",
        likeCount: 0,
        createdAt: 1,
      });
      await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-1",
        type: "follow",
        dedupeKey: "follow:actor-1",
        createdAt: 1,
      });
      await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-1",
        type: "post_like",
        dedupeKey: `post_like:${postId}`,
        postId,
        createdAt: 2,
      });
      await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-1",
        type: "comment",
        dedupeKey: `comment:${commentId}`,
        postId,
        commentId,
        createdAt: 3,
      });
      return { postId, commentId };
    });

    const result = await t
      .withIdentity(identity)
      .query(api.notifications.getNotifications, {
        paginationOpts: { numItems: 10, cursor: null },
      });

    expect(result.page.map((row) => row.type)).toEqual([
      "comment",
      "post_like",
      "follow",
    ]);
    expect(result.page[0]).toMatchObject({
      type: "comment",
      postId,
      commentId,
      postTitle: "A post",
      excerpt: "a long comment",
      actorName: "Actor",
    });
    expect(result.page[2]).toMatchObject({ type: "follow" });
    expect(result.page[2]).not.toHaveProperty("postTitle");
  });

  it("hydrates both actors when two people act on the same post", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "two-actors@example.com",
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 1,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      for (const [userId, displayName] of [
        ["actor-1", "First Actor"],
        ["actor-2", "Second Actor"],
      ] as const) {
        await ctx.db.insert("users", {
          userId,
          displayName,
          publishedPostCount: 0,
          unreadNotificationCount: 0,
          createdAt: 1,
        });
      }
      const postId = await ctx.db.insert("posts", {
        title: "A post",
        body: "Body.",
        tags: [],
        authorId: identity.subject,
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      for (const [i, actorId] of ["actor-1", "actor-2"].entries()) {
        await ctx.db.insert("notifications", {
          recipientId: identity.subject,
          actorId,
          type: "post_like",
          dedupeKey: `post_like:${postId}`,
          postId,
          createdAt: i + 1,
        });
      }
    });

    const result = await t
      .withIdentity(identity)
      .query(api.notifications.getNotifications, {
        paginationOpts: { numItems: 10, cursor: null },
      });

    expect(result.page).toHaveLength(2);
    expect(result.page.map((row) => row.actorName)).toEqual([
      "Second Actor",
      "First Actor",
    ]);
  });

  it("paginates mixed types across cursors without dropping rows", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "pager@example.com");
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 1,
        unreadNotificationCount: 3,
        createdAt: 1,
      });
      const postId = await ctx.db.insert("posts", {
        title: "A post",
        body: "Body.",
        tags: [],
        authorId: identity.subject,
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-follow",
        type: "follow",
        dedupeKey: "follow:actor-follow",
        createdAt: 1,
      });
      await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-like",
        type: "post_like",
        dedupeKey: `post_like:${postId}`,
        postId,
        createdAt: 2,
      });
      await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-comment",
        type: "post_like",
        dedupeKey: `post_like:${postId}`,
        postId,
        createdAt: 3,
      });
    });

    const first = await t
      .withIdentity(identity)
      .query(api.notifications.getNotifications, {
        paginationOpts: { numItems: 2, cursor: null },
      });
    const second = await t
      .withIdentity(identity)
      .query(api.notifications.getNotifications, {
        paginationOpts: { numItems: 2, cursor: first.continueCursor },
      });

    expect(first.page.map((row) => row.type)).toEqual([
      "post_like",
      "post_like",
    ]);
    expect(second.page.map((row) => row.type)).toEqual(["follow"]);
  });

  it("drops notification rows whose post is no longer published", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "draft-reader@example.com",
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 1,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      const postId = await ctx.db.insert("posts", {
        title: "Draft now",
        body: "Body.",
        tags: [],
        authorId: identity.subject,
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-1",
        type: "post_like",
        dedupeKey: `post_like:${postId}`,
        postId,
        createdAt: 1,
      });
    });

    const result = await t
      .withIdentity(identity)
      .query(api.notifications.getNotifications, {
        paginationOpts: { numItems: 10, cursor: null },
      });

    expect(result.page).toHaveLength(0);
    expect(result.isDone).toBe(true);
  });

  it("renders a row whose actor no longer exists", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "ghost-reader@example.com",
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 0,
        unreadNotificationCount: 1,
        createdAt: 1,
      });
      await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "ghost",
        type: "follow",
        dedupeKey: "follow:ghost",
        createdAt: 1,
      });
    });

    const result = await t
      .withIdentity(identity)
      .query(api.notifications.getNotifications, {
        paginationOpts: { numItems: 10, cursor: null },
      });

    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({
      type: "follow",
      actorName: null,
      actorUsername: null,
      actorAvatarUrl: null,
    });
  });

  it("deletes an unread notification and decrements the badge", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "dismisser@example.com",
    );
    const notificationId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 0,
        unreadNotificationCount: 1,
        createdAt: 1,
      });
      return await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor",
        type: "follow",
        dedupeKey: "follow:actor",
        createdAt: 1,
      });
    });

    await t.withIdentity(identity).mutation(api.notifications.dismiss, {
      notificationId,
    });

    expect(await t.run((ctx) => ctx.db.get(notificationId))).toBeNull();
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique(),
    );
    expect(user?.unreadNotificationCount).toBe(0);
  });

  it("deletes a read notification without touching the badge", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "dismiss-read@example.com",
    );
    const notificationId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      return await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor",
        type: "follow",
        dedupeKey: "follow:actor",
        createdAt: 1,
        readAt: 2,
      });
    });

    await t.withIdentity(identity).mutation(api.notifications.dismiss, {
      notificationId,
    });

    expect(await t.run((ctx) => ctx.db.get(notificationId))).toBeNull();
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique(),
    );
    expect(user?.unreadNotificationCount).toBe(0);
  });

  it("refuses to delete someone else's notification", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "intruder@example.com",
    );
    const notificationId = await t.run((ctx) =>
      ctx.db.insert("notifications", {
        recipientId: "someone-else",
        actorId: "actor",
        type: "follow",
        dedupeKey: "follow:actor",
        createdAt: 1,
      }),
    );

    await expect(
      t.withIdentity(identity).mutation(api.notifications.dismiss, {
        notificationId,
      }),
    ).rejects.toThrow("Notification not found.");
  });

  it("prunes only read rows older than the retention window", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const { oldRead, recentRead, unread } = await t.run(async (ctx) => ({
      oldRead: await ctx.db.insert("notifications", {
        recipientId: "reader",
        actorId: "a",
        type: "follow",
        dedupeKey: "follow:a",
        createdAt: 1,
        readAt: now - READ_RETENTION_MS - 1,
      }),
      recentRead: await ctx.db.insert("notifications", {
        recipientId: "reader",
        actorId: "b",
        type: "follow",
        dedupeKey: "follow:b",
        createdAt: 2,
        readAt: now - READ_RETENTION_MS + 60_000,
      }),
      unread: await ctx.db.insert("notifications", {
        recipientId: "reader",
        actorId: "c",
        type: "follow",
        dedupeKey: "follow:c",
        createdAt: 3,
      }),
    }));

    await t.mutation(internal.notifications.pruneReadNotifications, {
      cursor: null,
    });

    expect(await t.run((ctx) => ctx.db.get(oldRead))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(recentRead))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(unread))).not.toBeNull();
  });

  it("counts notification rows for the recipient only", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "counter@example.com",
    );
    await t.run(async (ctx) => {
      const rows = [
        { recipientId: identity.subject, readAt: undefined },
        { recipientId: identity.subject, readAt: 2 },
        { recipientId: identity.subject, readAt: undefined },
        { recipientId: "someone-else", readAt: undefined },
      ];
      for (const [index, row] of rows.entries()) {
        await ctx.db.insert("notifications", {
          recipientId: row.recipientId,
          actorId: `actor-${index}`,
          type: "follow",
          dedupeKey: `follow:actor-${index}`,
          createdAt: index + 1,
          readAt: row.readAt,
        });
      }
    });

    const counts = await t
      .withIdentity(identity)
      .query(api.notifications.getNotificationCounts, {});

    expect(counts).toEqual({
      total: 3,
      read: 1,
      unread: 2,
      truncated: false,
    });
  });

  it("dismisses read rows without changing the unread badge", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "read-scope@example.com",
    );
    const ids = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 0,
        unreadNotificationCount: 2,
        createdAt: 1,
      });
      const readA = await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-a",
        type: "follow",
        dedupeKey: "follow:actor-a",
        createdAt: 1,
        readAt: 2,
      });
      const readB = await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-b",
        type: "follow",
        dedupeKey: "follow:actor-b",
        createdAt: 2,
        readAt: 3,
      });
      const unreadA = await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-c",
        type: "follow",
        dedupeKey: "follow:actor-c",
        createdAt: 3,
      });
      const unreadB = await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-d",
        type: "follow",
        dedupeKey: "follow:actor-d",
        createdAt: 4,
      });
      return { readA, readB, unreadA, unreadB };
    });

    await t
      .withIdentity(identity)
      .mutation(api.notifications.dismissAll, { scope: "read" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.run((ctx) => ctx.db.get(ids.readA))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.readB))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.unreadA))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.unreadB))).not.toBeNull();
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique(),
    );
    expect(user?.unreadNotificationCount).toBe(2);
  });

  it("dismisses unread rows and drops the badge by the deleted count", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "unread-scope@example.com",
    );
    const ids = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 0,
        unreadNotificationCount: 3,
        createdAt: 1,
      });
      const read = await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-a",
        type: "follow",
        dedupeKey: "follow:actor-a",
        createdAt: 1,
        readAt: 2,
      });
      const unreadA = await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-b",
        type: "follow",
        dedupeKey: "follow:actor-b",
        createdAt: 2,
      });
      const unreadB = await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-c",
        type: "follow",
        dedupeKey: "follow:actor-c",
        createdAt: 3,
      });
      const unreadC = await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-d",
        type: "follow",
        dedupeKey: "follow:actor-d",
        createdAt: 4,
      });
      return { read, unreadA, unreadB, unreadC };
    });

    await t
      .withIdentity(identity)
      .mutation(api.notifications.dismissAll, { scope: "unread" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.run((ctx) => ctx.db.get(ids.read))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.unreadA))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.unreadB))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.unreadC))).toBeNull();
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique(),
    );
    expect(user?.unreadNotificationCount).toBe(0);
  });

  it("dismisses all rows and zeroes the badge", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "all-scope@example.com",
    );
    const ids = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 0,
        unreadNotificationCount: 1,
        createdAt: 1,
      });
      return {
        read: await ctx.db.insert("notifications", {
          recipientId: identity.subject,
          actorId: "actor-a",
          type: "follow",
          dedupeKey: "follow:actor-a",
          createdAt: 1,
          readAt: 2,
        }),
        unread: await ctx.db.insert("notifications", {
          recipientId: identity.subject,
          actorId: "actor-b",
          type: "follow",
          dedupeKey: "follow:actor-b",
          createdAt: 2,
        }),
      };
    });

    await t
      .withIdentity(identity)
      .mutation(api.notifications.dismissAll, { scope: "all" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.run((ctx) => ctx.db.get(ids.read))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.unread))).toBeNull();
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique(),
    );
    expect(user?.unreadNotificationCount).toBe(0);
  });

  it("keeps a notification inserted after the sweep starts", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "sweep-race@example.com",
    );
    const watermark = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Reader",
        publishedPostCount: 0,
        unreadNotificationCount: 1,
        createdAt: 1,
      });
      await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-before",
        type: "follow",
        dedupeKey: "follow:actor-before",
        createdAt: 1,
      });
    });

    await t
      .withIdentity(identity)
      .mutation(api.notifications.dismissAll, { scope: "all" });

    const survivorId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("notifications", {
        recipientId: identity.subject,
        actorId: "actor-after",
        type: "follow",
        dedupeKey: "follow:actor-after",
        createdAt: watermark + 1,
      });
      const user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique();
      await ctx.db.patch(user!._id, { unreadNotificationCount: 2 });
      return id;
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.run((ctx) => ctx.db.get(survivorId))).not.toBeNull();
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique(),
    );
    expect(user?.unreadNotificationCount).toBe(1);
  });
});
