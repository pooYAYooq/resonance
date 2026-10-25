/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { applyMarkRead } from "./notifications";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 26);
const READ_WINDOW = 90 * DAY;
const UNREAD_WINDOW = 730 * DAY;

function recipient(
  ctx: MutationCtx,
  userId: string,
  unreadNotificationCount: number,
) {
  return ctx.db.insert("users", {
    userId,
    displayName: userId,
    followerCount: 0,
    followingCount: 0,
    publishedPostCount: 0,
    unreadNotificationCount,
    createdAt: NOW,
  });
}

function notice(
  ctx: MutationCtx,
  recipientId: string,
  createdAt: number,
  readAt?: number,
) {
  return ctx.db.insert("notifications", {
    recipientId,
    actorId: "actor",
    type: "follow",
    dedupeKey: "follow:actor",
    createdAt,
    ...(readAt === undefined ? {} : { readAt }),
  });
}

describe("notification retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("keeps 90 days of read history, with strict cutoff boundaries and no counter change", async () => {
    const t = convexTest(schema, modules);
    const cutoff = NOW - READ_WINDOW;
    const { user, expired, boundary, recent, unread } = await t.run(
      async (ctx) => ({
        user: await recipient(ctx, "reader", 1),
        expired: await notice(ctx, "reader", 1, cutoff - 1),
        boundary: await notice(ctx, "reader", 1, cutoff),
        recent: await notice(ctx, "reader", 1, NOW - 45 * DAY),
        unread: await notice(ctx, "reader", NOW),
      }),
    );
    await t.mutation(internal.notifications.pruneReadNotifications, {
      cursor: null,
    });
    expect(await t.run((ctx) => ctx.db.get(expired))).toBeNull();
    for (const id of [boundary, recent, unread]) {
      expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
    }
    expect(
      (await t.run((ctx) => ctx.db.get(user)))?.unreadNotificationCount,
    ).toBe(1);
    vi.setSystemTime(NOW + 1);
    await t.mutation(internal.notifications.pruneReadNotifications, {
      cursor: null,
    });
    expect(await t.run((ctx) => ctx.db.get(boundary))).toBeNull();
  });

  it("expires only unread rows older than 730 days and adjusts each recipient once", async () => {
    const t = convexTest(schema, modules);
    const cutoff = NOW - UNREAD_WINDOW;
    const data = await t.run(async (ctx) => ({
      a: await recipient(ctx, "a", 4),
      b: await recipient(ctx, "b", 1),
      expired: [
        await notice(ctx, "a", cutoff - 2),
        await notice(ctx, "a", cutoff - 1),
        await notice(ctx, "b", cutoff - 1),
      ],
      boundary: await notice(ctx, "a", cutoff),
      recent: await notice(ctx, "a", cutoff + 1),
      oldButRead: await notice(ctx, "b", 1, NOW),
    }));
    await t.mutation(internal.notifications.pruneUnreadNotifications, {
      cursor: null,
    });
    for (const id of data.expired)
      expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
    for (const id of [data.boundary, data.recent, data.oldButRead])
      expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.get(data.a)))?.unreadNotificationCount,
    ).toBe(2);
    expect(
      (await t.run((ctx) => ctx.db.get(data.b)))?.unreadNotificationCount,
    ).toBe(0);
    await t.mutation(internal.notifications.pruneUnreadNotifications, {
      cursor: null,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(data.a)))?.unreadNotificationCount,
    ).toBe(2);
    vi.setSystemTime(NOW + 1);
    await t.mutation(internal.notifications.pruneUnreadNotifications, {
      cursor: null,
    });
    expect(await t.run((ctx) => ctx.db.get(data.boundary))).toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.get(data.a)))?.unreadNotificationCount,
    ).toBe(1);
  });

  it("gives a nearly expired unread row a full read period without restarting it on repeat reads", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
      await recipient(ctx, "reader", 1);
      const id = await notice(ctx, "reader", NOW - UNREAD_WINDOW + 1);
      await applyMarkRead(ctx, "reader", id, NOW);
      return id;
    });
    vi.setSystemTime(NOW + 45 * DAY);
    await t.run((ctx) => applyMarkRead(ctx, "reader", id, Date.now()));
    expect((await t.run((ctx) => ctx.db.get(id)))?.readAt).toBe(NOW);
    await t.mutation(internal.notifications.pruneUnreadNotifications, {
      cursor: null,
    });
    await t.mutation(internal.notifications.pruneReadNotifications, {
      cursor: null,
    });
    expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
    vi.setSystemTime(NOW + READ_WINDOW + 1);
    await t.mutation(internal.notifications.pruneReadNotifications, {
      cursor: null,
    });
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
  });

  it.each(["read", "unread"] as const)(
    "drains bounded %s batches using the original sweep cutoff",
    async (kind) => {
      const t = convexTest(schema, modules);
      const cutoff = NOW - (kind === "read" ? READ_WINDOW : UNREAD_WINDOW);
      const data = await t.run(async (ctx) => {
        const user = await recipient(
          ctx,
          "reader",
          kind === "unread" ? 106 : 0,
        );
        const expired = [];
        for (let i = 0; i < 105; i++) {
          expired.push(
            await notice(
              ctx,
              "reader",
              cutoff - 1000 + i,
              kind === "read" ? cutoff - 1000 + i : undefined,
            ),
          );
        }
        const boundary = await notice(
          ctx,
          "reader",
          cutoff,
          kind === "read" ? cutoff : undefined,
        );
        return { user, expired, boundary };
      });
      const fn =
        kind === "read"
          ? internal.notifications.pruneReadNotifications
          : internal.notifications.pruneUnreadNotifications;
      const first = await t.mutation(fn, { cursor: null });
      expect(first.deleted).toBe(100);
      expect(first.isDone).toBe(false);
      // Moving the clock must not pull the boundary into a continuation batch.
      vi.setSystemTime(NOW + DAY);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      for (const id of data.expired)
        expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
      expect(await t.run((ctx) => ctx.db.get(data.boundary))).not.toBeNull();
      expect(
        (await t.run((ctx) => ctx.db.get(data.user)))?.unreadNotificationCount,
      ).toBe(kind === "unread" ? 1 : 0);
      await t.mutation(fn, { cursor: null });
      expect(await t.run((ctx) => ctx.db.get(data.boundary))).toBeNull();
    },
  );

  it("does not double decrement when a queued candidate is read or manually deleted between batches", async () => {
    const t = convexTest(schema, modules);
    const data = await t.run(async (ctx) => {
      const reader = await recipient(ctx, "reader", 105);
      const manual = await recipient(ctx, "manual", 1);
      const ids = [];
      for (let i = 0; i < 105; i++)
        ids.push(await notice(ctx, "reader", NOW - UNREAD_WINDOW - 1000 + i));
      await notice(ctx, "manual", NOW - UNREAD_WINDOW - 1);
      return { reader, manual, marked: ids[100] };
    });
    await t.mutation(internal.notifications.pruneUnreadNotifications, {
      cursor: null,
    });
    await t.run(async (ctx) => {
      await notice(ctx, "reader", NOW);
      const user = await ctx.db.get(data.reader);
      await ctx.db.patch(data.reader, {
        unreadNotificationCount: user!.unreadNotificationCount + 1,
      });
    });
    await t.run((ctx) => applyMarkRead(ctx, "reader", data.marked, NOW));
    await t.mutation(internal.notifications.dismissBatch, {
      recipientId: "manual",
      scope: "unread",
      watermark: NOW,
      cursor: null,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(internal.notifications.pruneUnreadNotifications, {
      cursor: null,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(data.reader)))?.unreadNotificationCount,
    ).toBe(1);
    expect(
      (await t.run((ctx) => ctx.db.get(data.manual)))?.unreadNotificationCount,
    ).toBe(0);
    expect((await t.run((ctx) => ctx.db.get(data.marked)))?.readAt).toBe(NOW);
  });

  it.each([-1, 1.5])(
    "rolls back the entire unread batch for invalid counter %s",
    async (count) => {
      const t = convexTest(schema, modules);
      const data = await t.run(async (ctx) => ({
        good: await recipient(ctx, "good", 1),
        bad: await recipient(ctx, "bad", count),
        first: await notice(ctx, "good", 1),
        second: await notice(ctx, "bad", 2),
      }));
      await expect(
        t.mutation(internal.notifications.pruneUnreadNotifications, {
          cursor: null,
        }),
      ).rejects.toThrow("Unread notification counter is invalid.");
      for (const id of [data.first, data.second])
        expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
      expect(
        (await t.run((ctx) => ctx.db.get(data.good)))?.unreadNotificationCount,
      ).toBe(1);
      expect(
        (await t.run((ctx) => ctx.db.get(data.bad)))?.unreadNotificationCount,
      ).toBe(count);
    },
  );

  it("removes orphan notifications and clamps a stale zero counter", async () => {
    const t = convexTest(schema, modules);
    const data = await t.run(async (ctx) => ({
      user: await recipient(ctx, "reader", 0),
      stale: await notice(ctx, "reader", 1),
      orphan: await notice(ctx, "missing", 1),
    }));
    await t.mutation(internal.notifications.pruneUnreadNotifications, {
      cursor: null,
    });
    expect(await t.run((ctx) => ctx.db.get(data.stale))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(data.orphan))).toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.get(data.user)))?.unreadNotificationCount,
    ).toBe(0);
  });

  it("expires every notification type without removing its source content or relationships", async () => {
    const t = convexTest(schema, modules);
    const data = await t.run(async (ctx) => {
      const reader = await recipient(ctx, "reader", 2);
      const post = await ctx.db.insert("posts", {
        authorId: "reader",
        title: "Keep this post",
        body: "Body",
        tags: [],
        status: "published",
        commentCount: 1,
        likeCount: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      const comment = await ctx.db.insert("comments", {
        postId: post,
        authorId: "actor",
        authorName: "Actor",
        body: "Keep this comment",
        likeCount: 1,
        createdAt: 1,
      });
      const like = await ctx.db.insert("likes", {
        postId: post,
        userId: "actor",
        createdAt: 1,
      });
      const commentLike = await ctx.db.insert("commentLikes", {
        commentId: comment,
        userId: "reader",
        createdAt: 1,
      });
      const follow = await ctx.db.insert("follows", {
        followerId: "actor",
        followingId: "reader",
        createdAt: 1,
      });
      const notifications = [];
      for (const type of [
        "follow",
        "post_like",
        "comment",
        "comment_like",
      ] as const) {
        notifications.push(
          await ctx.db.insert("notifications", {
            recipientId: "reader",
            actorId: "actor",
            type,
            dedupeKey: `${type}:target`,
            createdAt: 1,
            ...(type === "follow" ? {} : { postId: post }),
            ...(type === "comment" || type === "comment_like"
              ? { commentId: comment, readAt: NOW - READ_WINDOW - 1 }
              : {}),
          }),
        );
      }
      return {
        reader,
        post,
        comment,
        like,
        commentLike,
        follow,
        notifications,
      };
    });
    await t.mutation(internal.notifications.pruneReadNotifications, {
      cursor: null,
    });
    await t.mutation(internal.notifications.pruneUnreadNotifications, {
      cursor: null,
    });
    for (const id of data.notifications)
      expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
    for (const id of [
      data.post,
      data.comment,
      data.like,
      data.commentLike,
      data.follow,
    ]) {
      expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
    }
    expect(
      (await t.run((ctx) => ctx.db.get(data.reader)))?.unreadNotificationCount,
    ).toBe(0);
    expect((await t.run((ctx) => ctx.db.get(data.post)))?.likeCount).toBe(1);
    expect((await t.run((ctx) => ctx.db.get(data.comment)))?.likeCount).toBe(1);
  });
});
