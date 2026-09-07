/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register } from "@convex-dev/better-auth/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
import { consumeSessionMediaClaims } from "./sessionMediaClaims";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => vi.useRealTimers());

async function createAuthenticatedTestUser(
  t: ReturnType<typeof convexTest>,
  email: string,
) {
  register(t);
  const identity = await t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Session owner",
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
            expiresAt: now + 24 * 60 * 60 * 1000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  await t.withIdentity(identity).mutation(api.users.syncUser, {});
  return identity;
}

async function createPendingAsset(
  t: ReturnType<typeof convexTest>,
  userId: string,
) {
  const now = Date.now();
  const storageId = await t.run(async (ctx) =>
    ctx.storage.store(new Blob([new Uint8Array([1])], { type: "image/png" })),
  );
  await t.run(async (ctx) => {
    await ctx.db.insert("pendingUploads", {
      userId,
      storageId,
      createdAt: now,
      expiresAt: now + 60 * 60 * 1000,
    });
  });
  return storageId;
}

describe("session media claims", () => {
  it("requires an authenticated owner-backed pending asset", async () => {
    const t = convexTest(schema, modules);
    const storageId = await createPendingAsset(t, "owner-1");

    await expect(
      t.mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      }),
    ).rejects.toThrow("Unauthorized");

    const identity = await createAuthenticatedTestUser(t, "owner@example.com");
    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      }),
    ).rejects.toThrow("Media asset is not eligible for this session");
  });

  it("rejects an expired orphan upload and stale consumed media", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "stale@example.com");
    const expiredStorageId = await createPendingAsset(t, identity.subject);
    const consumedStorageId = await createPendingAsset(t, identity.subject);
    await t.run(async (ctx) => {
      const claims = await ctx.db
        .query("pendingUploads")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .take(10);
      for (const claim of claims) {
        if (claim.storageId === expiredStorageId) {
          await ctx.db.patch(claim._id, { expiresAt: Date.now() - 1 });
        }
        if (claim.storageId === consumedStorageId) {
          await ctx.db.patch(claim._id, {
            consumedAt: Date.now(),
            expiresAt: Number.MAX_SAFE_INTEGER,
          });
        }
      }
    });

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId: expiredStorageId,
      }),
    ).rejects.toThrow("Media asset is not eligible for this session");
    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId: consumedStorageId,
      }),
    ).rejects.toThrow("Media asset is not eligible for this session");
  });

  it("allows a consumed asset only while its owned post still references it", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "retained@example.com",
    );
    const storageId = await createPendingAsset(t, identity.subject);
    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Retained media",
        body: JSON.stringify({ format: "blocknote@1", blocks: [] }),
        tags: [],
        authorId: identity.subject,
        imageStorageId: storageId,
        status: "published",
        publishedAt: Date.now(),
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const claim = await ctx.db
        .query("pendingUploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .unique();
      if (!claim) throw new Error("Pending claim missing");
      await ctx.db.patch(claim._id, {
        postId,
        consumedAt: Date.now(),
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      return postId;
    });

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      }),
    ).resolves.toMatchObject({ expiresAt: expect.any(Number) });

    await t.run(async (ctx) => ctx.db.delete(postId));
    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-2",
        storageId,
      }),
    ).rejects.toThrow("Media asset is not eligible for this session");
  });

  it("keeps independent tabs independently renewable and idempotent", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "tabs@example.com");
    const storageId = await createPendingAsset(t, identity.subject);

    const first = await t
      .withIdentity(identity)
      .mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      });
    const repeated = await t
      .withIdentity(identity)
      .mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      });
    const second = await t
      .withIdentity(identity)
      .mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-2",
        storageId,
      });

    expect(repeated.claimId).toBe(first.claimId);
    expect(second.claimId).not.toBe(first.claimId);
  });

  it("replays a live exact claim after its pending upload expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T00:00:00.000Z"));
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "replay@example.com");
    const storageId = await createPendingAsset(t, identity.subject);
    await t.run(async (ctx) => {
      const pendingUpload = await ctx.db
        .query("pendingUploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .unique();
      if (!pendingUpload) throw new Error("Pending upload missing");
      await ctx.db.patch(pendingUpload._id, { expiresAt: Date.now() + 1 });
    });
    const claimed = await t
      .withIdentity(identity)
      .mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      });

    vi.advanceTimersByTime(2);

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      }),
    ).resolves.toEqual(claimed);
  });

  it("fails loudly when duplicate exact claims violate the invariant", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "duplicate@example.com",
    );
    const storageId = await createPendingAsset(t, identity.subject);
    const now = Date.now();
    await t.run(async (ctx) => {
      for (let index = 0; index < 2; index += 1) {
        await ctx.db.insert("sessionMediaClaims", {
          userId: identity.subject,
          sessionId: "editor-1",
          storageId,
          createdAt: now,
          renewedAt: now,
          expiresAt: now + 60 * 60 * 1000,
        });
      }
    });

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      }),
    ).rejects.toThrow();
  });

  it("renews only after the server interval for an active visible session", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-09-07T00:00:00.000Z");
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "renew@example.com");
    const storageId = await createPendingAsset(t, identity.subject);
    await t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
      sessionId: "editor-1",
      storageId,
    });

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.renew, {
        sessionId: "editor-1",
        storageIds: [storageId],
        isVisible: true,
        isActive: true,
      }),
    ).resolves.toEqual({ renewed: 0 });

    vi.advanceTimersByTime(5 * 60 * 1000);
    const renewed = await t
      .withIdentity(identity)
      .mutation(api.sessionMediaClaims.renew, {
        sessionId: "editor-1",
        storageIds: [storageId],
        isVisible: true,
        isActive: true,
      });

    expect(renewed.renewed).toBe(1);
    expect(renewed.expiresAt).toBe(Date.now() + 60 * 60 * 1000);
  });

  it("rejects hidden or inactive renewal and never resurrects expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "expiry@example.com");
    const storageId = await createPendingAsset(t, identity.subject);
    await t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
      sessionId: "editor-1",
      storageId,
    });
    vi.advanceTimersByTime(5 * 60 * 1000);

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.renew, {
        sessionId: "editor-1",
        storageIds: [storageId],
        isVisible: false,
        isActive: true,
      }),
    ).rejects.toThrow("Renewal requires a visible active session");

    vi.advanceTimersByTime(60 * 60 * 1000);
    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.renew, {
        sessionId: "editor-1",
        storageIds: [storageId],
        isVisible: true,
        isActive: true,
      }),
    ).resolves.toEqual({ renewed: 0 });
  });

  it("releases an active claim", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "release@example.com",
    );
    const storageId = await createPendingAsset(t, identity.subject);
    await t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
      sessionId: "editor-1",
      storageId,
    });

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.release, {
        sessionId: "editor-1",
        storageIds: [storageId],
      }),
    ).resolves.toEqual({ released: 1 });

    const claim = await t.run(async (ctx) =>
      ctx.db
        .query("sessionMediaClaims")
        .withIndex("by_userId_and_sessionId", (q) =>
          q.eq("userId", identity.subject).eq("sessionId", "editor-1"),
        )
        .unique(),
    );
    expect(claim?.releasedAt).toBeTypeOf("number");
  });

  it("does not return a consumed claim as active", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "consumed@example.com",
    );
    const storageId = await createPendingAsset(t, identity.subject);
    const claimed = await t
      .withIdentity(identity)
      .mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      });
    await t.run(async (ctx) =>
      ctx.db.patch(claimed.claimId, { consumedAt: Date.now() }),
    );

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId,
      }),
    ).rejects.toThrow("Media claim was consumed");
  });

  it("renews eligible claims without failing the rest of the batch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "batch-renew@example.com",
    );
    const firstStorageId = await createPendingAsset(t, identity.subject);
    const secondStorageId = await createPendingAsset(t, identity.subject);
    await t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
      sessionId: "editor-1",
      storageId: firstStorageId,
    });
    await t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
      sessionId: "editor-1",
      storageId: secondStorageId,
    });
    vi.advanceTimersByTime(5 * 60 * 1000);
    await t.run(async (ctx) => {
      const claims = await ctx.db
        .query("sessionMediaClaims")
        .withIndex("by_userId_and_sessionId", (q) =>
          q.eq("userId", identity.subject).eq("sessionId", "editor-1"),
        )
        .take(10);
      const firstClaim = claims.find(
        (claim) => claim.storageId === firstStorageId,
      );
      if (!firstClaim) throw new Error("First claim missing");
      await ctx.db.patch(firstClaim._id, { expiresAt: Date.now() - 1 });
    });

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.renew, {
        sessionId: "editor-1",
        storageIds: [firstStorageId, secondStorageId],
        isVisible: true,
        isActive: true,
      }),
    ).resolves.toMatchObject({ renewed: 1 });
  });

  it("bounds client batches", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "batch@example.com");
    const storageIds = await t.run(async (ctx) =>
      Promise.all(
        Array.from({ length: 101 }, () =>
          ctx.storage.store(
            new Blob([new Uint8Array([1])], { type: "image/png" }),
          ),
        ),
      ),
    );

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.renew, {
        sessionId: "editor-1",
        storageIds,
        isVisible: true,
        isActive: true,
      }),
    ).rejects.toThrow("Too many media claims");
  });

  it("consumes more than 100 internal session claims in one lifecycle call", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "large@example.com");
    const storageIds = await t.run(async (ctx) => {
      const ids = await Promise.all(
        Array.from({ length: 101 }, () =>
          ctx.storage.store(
            new Blob([new Uint8Array([1])], { type: "image/png" }),
          ),
        ),
      );
      for (const storageId of ids) {
        await ctx.db.insert("pendingUploads", {
          userId: identity.subject,
          storageId,
          createdAt: Date.now(),
          expiresAt: Date.now() + 60 * 60 * 1000,
        });
      }
      return ids;
    });

    const claimResults = [];
    for (const storageId of storageIds) {
      claimResults.push(
        await t.withIdentity(identity).mutation(api.sessionMediaClaims.claim, {
          sessionId: "editor-1",
          storageId,
        }),
      );
    }
    const repeatedLast = await t
      .withIdentity(identity)
      .mutation(api.sessionMediaClaims.claim, {
        sessionId: "editor-1",
        storageId: storageIds[100],
      });
    expect(repeatedLast.claimId).toBe(claimResults[100].claimId);

    vi.advanceTimersByTime(5 * 60 * 1000);
    const firstBatch = storageIds.slice(0, 100);
    const secondBatch = storageIds.slice(100);
    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.renew, {
        sessionId: "editor-1",
        storageIds: firstBatch,
        isVisible: true,
        isActive: true,
      }),
    ).resolves.toMatchObject({ renewed: 100 });
    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.renew, {
        sessionId: "editor-1",
        storageIds: secondBatch,
        isVisible: true,
        isActive: true,
      }),
    ).resolves.toMatchObject({ renewed: 1 });

    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.release, {
        sessionId: "editor-1",
        storageIds: firstBatch,
      }),
    ).resolves.toEqual({ released: 100 });
    await expect(
      t.withIdentity(identity).mutation(api.sessionMediaClaims.release, {
        sessionId: "editor-1",
        storageIds: secondBatch,
      }),
    ).resolves.toEqual({ released: 1 });

    await t.run(async (ctx) => {
      for (const storageId of storageIds) {
        const now = Date.now();
        await ctx.db.insert("sessionMediaClaims", {
          userId: identity.subject,
          sessionId: "editor-2",
          storageId,
          createdAt: now,
          renewedAt: now,
          expiresAt: now + 60 * 60 * 1000,
        });
      }
      await consumeSessionMediaClaims(ctx, identity.subject, storageIds);
    });
    const consumedCount = await t.run(async (ctx) => {
      const claims = await ctx.db
        .query("sessionMediaClaims")
        .withIndex("by_userId_and_sessionId", (q) =>
          q.eq("userId", identity.subject).eq("sessionId", "editor-2"),
        )
        .take(200);
      return claims.filter((claim) => claim.consumedAt !== undefined).length;
    });
    expect(consumedCount).toBe(101);
  });
});
