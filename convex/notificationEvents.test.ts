/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";
import {
  EXCERPT_LIMIT,
  commentExcerpt,
  engagementDedupeKey,
  recordEngagementNotification,
} from "./notificationEvents";

const modules = import.meta.glob("./**/*.ts");

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
    const t = convexTest(schema, modules);
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
    const t = convexTest(schema, modules);
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
    const t = convexTest(schema, modules);
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

  it("allows two comments by the same actor on the same post", async () => {
    const t = convexTest(schema, modules);
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
    const t = convexTest(schema, modules);
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
    expect(commentExcerpt("  one\n\ntwo  ")).toBe("one two");
    const long = "x".repeat(EXCERPT_LIMIT + 10);
    const excerpt = commentExcerpt(long);
    expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_LIMIT);
    expect(excerpt.endsWith("...")).toBe(true);
  });
});
