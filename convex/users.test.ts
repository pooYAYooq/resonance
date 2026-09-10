/**
 * Unit tests for Convex user queries and mutations.
 *
 * The tests here verify:
 * - Unauthenticated callers are rejected by `syncUser`.
 * - Authentication sync normalizes provider display names.
 * - Queries return `null` for non-existent records.
 * - The schema and indexes are correctly wired.
 */

/// <reference types="vite/client" />

import { register } from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createAuthIdentity(
  t: ReturnType<typeof convexTest>,
  name: string,
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name,
          email: "auth-user@example.com",
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
            token: `session-${user._id}`,
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

describe("users functions", () => {
  it("syncUser rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.users.syncUser, {})).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("stores Anonymous for a whitespace-only provider name", async () => {
    const t = convexTest(schema, modules);
    register(t);
    const identity = await createAuthIdentity(t, "   ");

    await t.withIdentity(identity).mutation(api.users.syncUser, {});

    await expect(
      t.run(async (ctx) =>
        ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
          .unique(),
      ),
    ).resolves.toMatchObject({ displayName: "Anonymous" });
  });

  it("getCurrentUser returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.users.getCurrentUser, {});
    expect(result).toBeNull();
  });

  it("getUserProfile returns only public profile fields to anonymous callers", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "alice-auth-id",
        displayName: "Alice",
        email: "alice@example.com",
        avatarUrl: "https://example.com/alice.png",
        bio: "Hello, I'm Alice!",
        followerCount: 0,
        followingCount: 0,
        unreadNotificationCount: 0,
        publishedPostCount: 2,
        createdAt: Date.now(),
      });

      for (let i = 0; i < 2; i++) {
        await ctx.db.insert("posts", {
          title: `Post ${i + 1}`,
          body: "Body.",
          tags: [],
          authorId: "alice-auth-id",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        });
      }
      await ctx.db.insert("posts", {
        title: "Draft",
        body: "Draft body.",
        tags: [],
        authorId: "alice-auth-id",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1002,
        updatedAt: 1002,
      });
      await ctx.db.insert("follows", {
        followerId: "another-user",
        followingId: "alice-auth-id",
        createdAt: 1003,
      });

      return "alice-auth-id";
    });

    const result = await t.query(api.users.getUserProfile, {
      userId,
    });
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("alice-auth-id");
    expect(result!.displayName).toBe("Alice");
    expect(result!.bio).toBe("Hello, I'm Alice!");
    expect(result!.avatarUrl).toBe("https://example.com/alice.png");
    expect(result!.followerCount).toBe(0);
    expect(result!.followingCount).toBe(0);
    expect(result!.postCount).toBe(2);
    // convex-test cannot authenticate Better Auth's component, so this proves
    // anonymous callers cannot inherit another user's follow relationship.
    // Authenticated viewer identity and follow state are derived exclusively
    // from safeGetAuthUser in the query implementation.
    expect(result!.viewerId).toBeNull();
    expect(result!.isFollowing).toBe(false);
    expect(Object.hasOwn(result!, "email")).toBe(false);
    expect(Object.hasOwn(result!, "unreadNotificationCount")).toBe(false);
    expect(Object.hasOwn(result!, "_id")).toBe(false);
    expect(Object.hasOwn(result!, "_creationTime")).toBe(false);
    expect(Object.hasOwn(result!, "createdAt")).toBe(false);
  });

  it("uses the maintained published count without scanning source posts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "counted-user",
        displayName: "Counted User",
        followerCount: 0,
        followingCount: 0,
        unreadNotificationCount: 0,
        publishedPostCount: 7,
        createdAt: 1,
      });
      for (let i = 0; i < 2; i++) {
        await ctx.db.insert("posts", {
          title: `Published ${i}`,
          body: "Body",
          tags: [],
          authorId: "counted-user",
          status: "published",
          publishedAt: i + 1,
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: i + 1,
          updatedAt: i + 1,
        });
      }
    });

    const result = await t.query(api.users.getUserProfile, {
      userId: "counted-user",
    });
    expect(result?.postCount).toBe(7);
  });

  it("getUserProfile returns null for missing user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.users.getUserProfile, {
      userId: "nonexistent",
    });
    expect(result).toBeNull();
  });
});
