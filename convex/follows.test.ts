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
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("follows functions", () => {
  it("rejects toggleFollow when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-auth-id",
        displayName: "Author",
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
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.follows.getFollowCounts, {
      userId: "author-auth-id",
    });
    expect(result).toEqual({ followerCount: 7, followingCount: 3 });
  });

  it("getFollowCounts returns zeros for a missing user", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.follows.getFollowCounts, {
      userId: "no-such-user",
    });
    expect(result).toEqual({ followerCount: 0, followingCount: 0 });
  });
});