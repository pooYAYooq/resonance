/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { adjustPublishedPostCount } from "./profilePostCount";

const modules = import.meta.glob("./**/*.ts");

describe("profile published-post count", () => {
  it("increments and decrements the required count transactionally", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        userId: "lifecycle-user",
        displayName: "Lifecycle User",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });

      await adjustPublishedPostCount(ctx, "lifecycle-user", 1);
      await adjustPublishedPostCount(ctx, "lifecycle-user", -1);

      expect((await ctx.db.get(userId))?.publishedPostCount).toBe(0);
    });
  });

  it("rejects a missing or invalid profile counter", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.run(async (ctx) => adjustPublishedPostCount(ctx, "missing-user", 1)),
    ).rejects.toThrow("User profile counter is missing.");

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "invalid-user",
        displayName: "Invalid User",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: -1,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
    });

    await expect(
      t.run(async (ctx) => adjustPublishedPostCount(ctx, "invalid-user", 1)),
    ).rejects.toThrow("User profile counter is invalid.");
  });
});
