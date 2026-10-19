/**
 * Unit tests for Convex follows queries and mutations.
 *
 * Auth-path tests (self-follow rejection, missing-user, count
 * denormalization on follow/unfollow) are omitted because convex-test
 * cannot mock the Better Auth component that `safeGetAuthUser` walks
 * (`convex/users.test.ts:1-7`, `convex/likes.test.ts`). These are
 * covered by manual testing and code inspection of `follows.ts`.
 * Here we cover the unauthenticated rejection path and the no-auth
 * query behavior, matching the precedent in `likes.test.ts`.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register } from "@convex-dev/better-auth/test";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import { incrementCounter, decrementCounter } from "./follows";
import schema from "./schema";

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

describe("follows functions", () => {
  it("validates follow counter arithmetic", () => {
    expect(incrementCounter(4, "follower")).toBe(5);
    expect(decrementCounter(1, "following")).toBe(0);
    expect(() => incrementCounter(Number.MAX_SAFE_INTEGER, "follower")).toThrow(
      "counter",
    );
    expect(() => decrementCounter(0, "following")).toThrow("counter");
    expect(() => decrementCounter(-1, "following")).toThrow("counter");
  });
  it("rejects toggleFollow when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-auth-id",
        displayName: "Author",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: Date.now(),
      });
    });

    await expect(
      t.mutation(api.follows.toggleFollow, {
        followingId: "author-auth-id",
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("isFollowing returns false when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-auth-id",
        displayName: "Author",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.follows.isFollowing, {
      followingId: "author-auth-id",
    });
    expect(result).toBe(false);
  });

  it("isFollowing returns false when no follow row exists for the caller", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-auth-id",
        displayName: "Author",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: Date.now(),
      });
      // A follow row exists, but its follower is someone else — and
      // the caller is unauthenticated, so the query short-circuits
      // to false before the probe runs.
      await ctx.db.insert("follows", {
        followerId: "someone-else",
        followingId: "author-auth-id",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.follows.isFollowing, {
      followingId: "author-auth-id",
    });
    expect(result).toBe(false);
  });

  it("getFollowCounts returns zeros for a user with no counts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-auth-id",
        displayName: "Author",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.follows.getFollowCounts, {
      userId: "author-auth-id",
    });
    expect(result).toEqual({ followerCount: 0, followingCount: 0 });
  });

  it("getFollowCounts reads denormalized counters from the user doc", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-auth-id",
        displayName: "Author",
        followerCount: 7,
        followingCount: 3,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.follows.getFollowCounts, {
      userId: "author-auth-id",
    });
    expect(result).toEqual({ followerCount: 7, followingCount: 3 });
  });

  it("returns zeros for a legacy user without follower counters", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "legacy-user",
        displayName: "Legacy User",
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.follows.getFollowCounts, {
      userId: "legacy-user",
    });
    expect(result).toEqual({ followerCount: 0, followingCount: 0 });
  });

  it("getFollowCounts returns zeros for a missing user", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.follows.getFollowCounts, {
      userId: "no-such-user",
    });
    expect(result).toEqual({ followerCount: 0, followingCount: 0 });
  });

  it("notifies the followed user once across repeated follows", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "follower@example.com",
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Follower",
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      await ctx.db.insert("users", {
        userId: "target-1",
        displayName: "Target",
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
    });

    await t
      .withIdentity(identity)
      .mutation(api.follows.toggleFollow, { followingId: "target-1" });
    const first = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(first).toHaveLength(1);
    await t.run((ctx) => ctx.db.patch(first[0]._id, { readAt: 5 }));

    await t
      .withIdentity(identity)
      .mutation(api.follows.toggleFollow, { followingId: "target-1" });
    await t
      .withIdentity(identity)
      .mutation(api.follows.toggleFollow, { followingId: "target-1" });

    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipientId: "target-1",
      actorId: identity.subject,
      type: "follow",
      createdAt: first[0].createdAt,
      readAt: 5,
    });
  });

  it("rejects a self-follow without writing a notification", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "self-follow@example.com",
    );
    await t.run((ctx) =>
      ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Self",
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      }),
    );

    await expect(
      t
        .withIdentity(identity)
        .mutation(api.follows.toggleFollow, { followingId: identity.subject }),
    ).rejects.toThrow("You can't follow yourself.");

    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect()),
    ).toHaveLength(0);
  });
});
