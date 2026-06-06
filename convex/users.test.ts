/**
 * Unit tests for Convex user queries and mutations.
 *
 * Auth-path tests (e.g. `syncUser` with a mocked Better Auth session) are
 * omitted because convex-test does not support the Better Auth component
 * registration pattern required to mock `safeGetAuthUser`. These behaviors
 * are covered by manual testing and code inspection of `users.ts`.
 *
 * The tests here verify:
 * - Unauthenticated callers are rejected by `syncUser`.
 * - Queries return `null` for non-existent records.
 * - The schema and indexes are correctly wired.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("users functions", () => {
  it("syncUser rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.users.syncUser, {})).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("getUserById returns null for non-existent user", async () => {
    const t = convexTest(schema, modules);
    const deletedId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        userId: "auth-user-123",
        displayName: "Test",
        createdAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });
    const result = await t.query(api.users.getUserById, {
      id: deletedId,
    });
    expect(result).toBeNull();
  });

  it("getUserByAuthId returns null for non-existent auth id", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.users.getUserByAuthId, {
      userId: "auth-user-123",
    });
    expect(result).toBeNull();
  });

  it("getUserByEmail returns null for non-existent email", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.users.getUserByEmail, {
      email: "test@example.com",
    });
    expect(result).toBeNull();
  });

  it("getCurrentUser returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.users.getCurrentUser, {});
    expect(result).toBeNull();
  });
});
