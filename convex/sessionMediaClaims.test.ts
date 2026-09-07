/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register } from "@convex-dev/better-auth/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

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
    ).rejects.toThrow("Media asset is not owned by this user");
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
    ).rejects.toThrow("Renewal is not due yet");

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
    ).rejects.toThrow("Media claim has expired");
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
});
