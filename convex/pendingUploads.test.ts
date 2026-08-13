/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("pending upload functions", () => {
  it("rejects unauthenticated session creation", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.pendingUploads.createPendingUpload, {}),
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects unauthenticated finalization", async () => {
    const t = convexTest(schema, modules);
    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert("pendingUploads", {
        userId: "owner-1",
        createdAt: 1,
        expiresAt: 2,
      }),
    );
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: "image/png" })),
    );

    await expect(
      t.mutation(api.pendingUploads.finalizePendingUpload, {
        sessionId,
        storageId,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects unauthenticated cleanup", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.pendingUploads.cleanupPending, { sessionIds: [] }),
    ).rejects.toThrow("Unauthorized");
  });

  it("accepts an uploaded storage ID for cleanup tracking", async () => {
    const t = convexTest(schema, modules);
    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert("pendingUploads", {
        userId: "owner-1",
        createdAt: 1,
        expiresAt: 2,
      }),
    );
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: "image/png" })),
    );

    await expect(
      t.mutation(api.pendingUploads.cleanupPending, {
        sessionIds: [sessionId],
        storageIds: [storageId],
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("stores finalized storage IDs and supports the required indexes", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: "image/png" })),
    );

    const row = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("pendingUploads", {
        userId: "owner-1",
        storageId,
        createdAt: 1,
        expiresAt: 2,
      });

      return {
        byStorageId: await ctx.db
          .query("pendingUploads")
          .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
          .unique(),
        byUserId: await ctx.db
          .query("pendingUploads")
          .withIndex("by_userId", (q) => q.eq("userId", "owner-1"))
          .unique(),
        byExpiresAt: await ctx.db
          .query("pendingUploads")
          .withIndex("by_expiresAt", (q) => q.lt("expiresAt", 3))
          .unique(),
        sessionId,
      };
    });

    expect(row.byStorageId?._id).toBe(row.sessionId);
    expect(row.byUserId?._id).toBe(row.sessionId);
    expect(row.byExpiresAt?._id).toBe(row.sessionId);
  });

  it("cleans expired files and rows while preserving live sessions", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const finalizedStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: "image/png" })),
    );
    const ids = await t.run(async (ctx) => ({
      finalized: await ctx.db.insert("pendingUploads", {
        userId: "owner-1",
        storageId: finalizedStorageId,
        createdAt: now - 2,
        expiresAt: now - 1,
      }),
      unfinalized: await ctx.db.insert("pendingUploads", {
        userId: "owner-1",
        createdAt: now - 2,
        expiresAt: now - 1,
      }),
      live: await ctx.db.insert("pendingUploads", {
        userId: "owner-1",
        createdAt: now,
        expiresAt: now + 60 * 60 * 1000,
      }),
    }));

    await t.mutation(internal.pendingUploads.cleanupExpired, { cursor: null });

    const result = await t.run(async (ctx) => ({
      finalized: await ctx.db.get(ids.finalized),
      unfinalized: await ctx.db.get(ids.unfinalized),
      live: await ctx.db.get(ids.live),
      file: await ctx.storage.get(finalizedStorageId),
    }));
    expect(result.finalized).toBeNull();
    expect(result.unfinalized).toBeNull();
    expect(result.live?._id).toBe(ids.live);
    expect(result.file).toBeNull();
  });

  it("continues bounded cleanup without deleting another owner's live session", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const finalizedStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: "image/png" })),
    );

    const expiredIds = await t.run(async (ctx) => {
      const ids = [];
      for (let index = 0; index < 100; index += 1) {
        ids.push(
          await ctx.db.insert("pendingUploads", {
            userId: "owner-1",
            createdAt: now - 2,
            expiresAt: now - 1,
          }),
        );
      }
      ids.push(
        await ctx.db.insert("pendingUploads", {
          userId: "owner-1",
          storageId: finalizedStorageId,
          createdAt: now - 2,
          expiresAt: now - 1,
        }),
      );
      return ids;
    });
    const liveOtherOwnerId = await t.run(async (ctx) =>
      ctx.db.insert("pendingUploads", {
        userId: "owner-2",
        createdAt: now,
        expiresAt: now + 60 * 60 * 1000,
      }),
    );

    await t.mutation(internal.pendingUploads.cleanupExpired, { cursor: null });
    await t.finishAllScheduledFunctions(() => undefined);

    const result = await t.run(async (ctx) => ({
      expired: await Promise.all(expiredIds.map((id) => ctx.db.get(id))),
      liveOtherOwner: await ctx.db.get(liveOtherOwnerId),
      file: await ctx.storage.get(finalizedStorageId),
    }));
    expect(result.expired.every((session) => session === null)).toBe(true);
    expect(result.liveOtherOwner?._id).toBe(liveOtherOwnerId);
    expect(result.file).toBeNull();
  });
});
