/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
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
      t.mutation(api.pendingUploads.cleanupPending, { uploads: [] }),
    ).rejects.toThrow("Unauthorized");
  });

  it("preserves expired claims associated with a draft", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: "image/png" })),
    );
    const { postId, claimId } = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Draft",
        body: "draft body",
        tags: [],
        authorId: "owner-1",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const claimId = await ctx.db.insert("pendingUploads", {
        userId: "owner-1",
        postId,
        storageId,
        createdAt: 1,
        expiresAt: 1,
      });
      return { postId, claimId };
    });

    await t.mutation(internal.pendingUploads.cleanupExpired, { cursor: null });

    const result = await t.run(async (ctx) => ({
      claim: await ctx.db.get(claimId),
      hasFile: (await ctx.storage.get(storageId)) !== null,
      post: await ctx.db.get(postId),
    }));
    expect(result.claim?._id).toBe(claimId);
    expect(result.hasFile).toBe(true);
    expect(result.post?._id).toBe(postId);
  });

  it("rejects unauthenticated cleanup with an uploaded storage ID fallback", async () => {
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
        uploads: [{ sessionId, storageId }],
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

  it("isolates a new cleanup run from a stale continuation after lease expiry", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      for (let index = 0; index <= 200; index += 1) {
        await ctx.db.insert("pendingUploads", {
          userId: "owner-1",
          createdAt: now - 2,
          expiresAt: now - 1,
        });
      }
    });

    await t.mutation(internal.pendingUploads.cleanupExpired, { cursor: null });
    const oldLock = await t.run(async (ctx) =>
      ctx.db
        .query("pendingUploadCleanupLocks")
        .withIndex("by_key", (q) => q.eq("key", "pending-inline-uploads"))
        .unique(),
    );
    if (!oldLock) {
      throw new Error("Expected the first cleanup run to acquire a lock");
    }

    await t.run(async (ctx) => {
      await ctx.db.patch(oldLock._id, { lockedUntil: 0 });
    });
    await t.mutation(internal.pendingUploads.cleanupExpired, { cursor: null });

    const newLock = await t.run(async (ctx) =>
      ctx.db
        .query("pendingUploadCleanupLocks")
        .withIndex("by_key", (q) => q.eq("key", "pending-inline-uploads"))
        .unique(),
    );
    expect(newLock).not.toBeNull();
    expect(newLock?._id).not.toBe(oldLock._id);

    await t.mutation(internal.pendingUploads.cleanupExpired, {
      cursor: null,
      runId: oldLock._id,
    });

    const survivingLock = await t.run(async (ctx) =>
      ctx.db.get(newLock?._id ?? oldLock._id),
    );
    expect(survivingLock?._id).toBe(newLock?._id);
    vi.useRealTimers();
  });
});
