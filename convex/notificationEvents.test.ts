/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "@convex-dev/rate-limiter/test";
import { FOLLOW_NOTIFICATION_PERIOD_MS } from "./rateLimiter";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";
import {
  EXCERPT_LIMIT,
  commentExcerpt,
  engagementDedupeKey,
  recordEngagementNotification,
} from "./notificationEvents";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

afterEach(() => vi.useRealTimers());

async function seedUser(ctx: MutationCtx, userId: string, displayName: string) {
  await ctx.db.insert("users", {
    userId,
    displayName,
    publishedPostCount: 0,
    unreadNotificationCount: 0,
    createdAt: 1,
  });
}

async function seedPost(ctx: MutationCtx, authorId: string) {
  return await ctx.db.insert("posts", {
    title: "Target",
    body: "Body.",
    tags: [],
    authorId,
    status: "published",
    commentCount: 0,
    likeCount: 0,
    uniqueViewCount: 0,
    createdAt: 1,
    updatedAt: 1,
  });
}

describe("recordEngagementNotification", () => {
  it("writes one row for the recipient and bumps the unread counter", async () => {
    const t = setup();
    const postId = await t.run(async (ctx) => {
      await seedUser(ctx, "recipient-1", "Recipient");
      await seedUser(ctx, "actor-1", "Actor");
      return await seedPost(ctx, "recipient-1");
    });

    const wrote = await t.run((ctx) =>
      recordEngagementNotification(ctx, {
        type: "post_like",
        recipientId: "recipient-1",
        actorId: "actor-1",
        postId,
      }),
    );

    expect(wrote).toBe(true);
    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipientId: "recipient-1",
      actorId: "actor-1",
      type: "post_like",
      dedupeKey: `post_like:${postId}`,
      postId,
    });
    const recipient = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", "recipient-1"))
        .unique(),
    );
    expect(recipient?.unreadNotificationCount).toBe(1);
  });

  it("writes nothing for a self-action", async () => {
    const t = setup();
    await t.run((ctx) => seedUser(ctx, "self-1", "Self"));

    const wrote = await t.run((ctx) =>
      recordEngagementNotification(ctx, {
        type: "follow",
        recipientId: "self-1",
        actorId: "self-1",
      }),
    );

    expect(wrote).toBe(false);
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect()),
    ).toHaveLength(0);
  });

  it("suppresses a repeat of the same event", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await seedUser(ctx, "recipient-1", "Recipient");
      await seedUser(ctx, "actor-1", "Actor");
    });

    const event = {
      type: "follow" as const,
      recipientId: "recipient-1",
      actorId: "actor-1",
    };
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      true,
    );
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      false,
    );

    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(rows).toHaveLength(1);
    const recipient = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", "recipient-1"))
        .unique(),
    );
    expect(recipient?.unreadNotificationCount).toBe(1);
  });

  it("allows another follow notification at seven days, retaining history and read state", async () => {
    vi.useFakeTimers();
    const start = Date.UTC(2026, 9, 21);
    vi.setSystemTime(start);
    const t = setup();
    const event = {
      type: "follow" as const,
      recipientId: "recipient",
      actorId: "actor",
    };
    await t.run((ctx) => seedUser(ctx, "recipient", "Recipient"));
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      true,
    );
    const first = await t.run((ctx) => ctx.db.query("notifications").first());
    await t.run(async (ctx) => {
      await ctx.db.patch(first!._id, { readAt: start });
      const recipient = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", "recipient"))
        .unique();
      await ctx.db.patch(recipient!._id, { unreadNotificationCount: 0 });
    });
    vi.setSystemTime(start + FOLLOW_NOTIFICATION_PERIOD_MS - 1);
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      false,
    );
    vi.setSystemTime(start + FOLLOW_NOTIFICATION_PERIOD_MS);
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      true,
    );
    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row._id === first!._id)?.readAt).toBe(start);
    expect(rows.find((row) => row._id !== first!._id)?.readAt).toBeUndefined();
    const recipient = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", "recipient"))
        .unique(),
    );
    expect(recipient?.unreadNotificationCount).toBe(1);
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      false,
    );
  });

  it("keeps the follow limit after notification deletion and isolates each pair", async () => {
    const t = setup();
    const event = {
      type: "follow" as const,
      recipientId: "recipient",
      actorId: "actor",
    };
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      true,
    );
    await t.run(async (ctx) => {
      const row = await ctx.db.query("notifications").first();
      await ctx.db.delete(row!._id);
    });
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      false,
    );
    expect(
      await t.run((ctx) =>
        recordEngagementNotification(ctx, { ...event, actorId: "other" }),
      ),
    ).toBe(true);
    expect(
      await t.run((ctx) =>
        recordEngagementNotification(ctx, { ...event, recipientId: "other" }),
      ),
    ).toBe(true);
  });

  it("initializes the allowance from an existing follow without extending its window", async () => {
    vi.useFakeTimers();
    const start = Date.UTC(2026, 9, 21);
    vi.setSystemTime(start);
    const t = setup();
    const event = {
      type: "follow" as const,
      recipientId: "recipient",
      actorId: "actor",
    };
    const id = await t.run((ctx) =>
      ctx.db.insert("notifications", {
        ...event,
        dedupeKey: engagementDedupeKey(event),
        createdAt: start,
      }),
    );
    vi.setSystemTime(start + 3 * 24 * 60 * 60 * 1000);
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      false,
    );
    await t.run((ctx) => ctx.db.delete(id));
    vi.setSystemTime(start + FOLLOW_NOTIFICATION_PERIOD_MS - 1);
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      false,
    );
    vi.setSystemTime(start + FOLLOW_NOTIFICATION_PERIOD_MS);
    expect(await t.run((ctx) => recordEngagementNotification(ctx, event))).toBe(
      true,
    );
  });

  it("allows two comments by the same actor on the same post", async () => {
    const t = setup();
    const { postId, first, second } = await t.run(async (ctx) => {
      await seedUser(ctx, "recipient-1", "Recipient");
      await seedUser(ctx, "actor-1", "Actor");
      const postId = await seedPost(ctx, "recipient-1");
      const insert = (body: string) =>
        ctx.db.insert("comments", {
          postId,
          authorId: "actor-1",
          authorName: "Actor",
          body,
          likeCount: 0,
          createdAt: 1,
        });
      return {
        postId,
        first: await insert("One"),
        second: await insert("Two"),
      };
    });

    await t.run(async (ctx) => {
      await recordEngagementNotification(ctx, {
        type: "comment",
        recipientId: "recipient-1",
        actorId: "actor-1",
        postId,
        commentId: first,
      });
      await recordEngagementNotification(ctx, {
        type: "comment",
        recipientId: "recipient-1",
        actorId: "actor-1",
        postId,
        commentId: second,
      });
    });

    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect()),
    ).toHaveLength(2);
  });

  it("writes one row per actor for the same target", async () => {
    const t = setup();
    const postId = await t.run(async (ctx) => {
      await seedUser(ctx, "recipient-1", "Recipient");
      await seedUser(ctx, "actor-1", "Actor One");
      await seedUser(ctx, "actor-2", "Actor Two");
      return await seedPost(ctx, "recipient-1");
    });

    await t.run(async (ctx) => {
      for (const actorId of ["actor-1", "actor-2"]) {
        await recordEngagementNotification(ctx, {
          type: "post_like",
          recipientId: "recipient-1",
          actorId,
          postId,
        });
      }
    });

    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(rows).toHaveLength(2);
    const recipient = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", "recipient-1"))
        .unique(),
    );
    expect(recipient?.unreadNotificationCount).toBe(2);
  });
});

describe("engagementDedupeKey", () => {
  it("scopes follow keys to the actor", () => {
    expect(
      engagementDedupeKey({
        type: "follow",
        recipientId: "r",
        actorId: "a",
      }),
    ).toBe("follow:a");
  });
});

describe("commentExcerpt", () => {
  it("collapses whitespace and bounds the total length", () => {
    expect(EXCERPT_LIMIT).toBe(90);
    expect(commentExcerpt("  one\n\ntwo  ")).toBe("one two");
    const long = "x".repeat(EXCERPT_LIMIT + 10);
    const excerpt = commentExcerpt(long);
    expect(excerpt).toBe(`${"x".repeat(EXCERPT_LIMIT - 3)}...`);
    expect(excerpt).toHaveLength(EXCERPT_LIMIT);
    expect(excerpt).not.toBe("...");
  });

  it("cuts at the last whole word before appending the ellipsis", () => {
    const excerpt = commentExcerpt("word ".repeat(40));

    expect(excerpt).toBe(`${"word ".repeat(17).trimEnd()}...`);
    expect(excerpt.endsWith("word...")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_LIMIT);
  });
});
