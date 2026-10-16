/// <reference types="vite/client" />

import { register as registerBetterAuth } from "@convex-dev/better-auth/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import { authComponent } from "./auth";
import {
  rateLimiter,
  USERNAME_CLAIM_LIMIT,
  USERNAME_CLAIM_PERIOD_MS,
} from "./rateLimiter";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const START = 1_800_000_000_000;

function setup() {
  const t = convexTest(schema, modules);
  registerBetterAuth(t);
  registerRateLimiter(t);
  return t;
}

async function signedIn(
  t: ReturnType<typeof setup>,
  email = "ada@example.com",
  sync = true,
) {
  const identity = await t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Ada",
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
            token: `session-${user._id}`,
            // Timing tests deliberately advance across multiple claim periods.
            expiresAt: now + 20 * USERNAME_CLAIM_PERIOD_MS,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  const own = t.withIdentity(identity);
  if (sync) await own.mutation(api.users.syncUser, {});
  return { own, ownerUserId: identity.subject };
}

async function allowance(t: ReturnType<typeof setup>, key: string) {
  return await t.run(
    async (ctx) =>
      await rateLimiter.getValue(ctx, USERNAME_CLAIM_LIMIT, { key }),
  );
}

async function claims(t: ReturnType<typeof setup>) {
  return await t.run(
    async (ctx) => await ctx.db.query("usernameClaims").take(300),
  );
}

describe("username ownership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("stores a normalized first claim and exposes it through both self-scoped reads", async () => {
    const t = setup();
    const { own, ownerUserId } = await signedIn(t);
    expect(
      await own.mutation(api.usernames.claimUsername, {
        username: "  PooYAYooq  ",
        expectedRevision: 0,
      }),
    ).toEqual({ kind: "saved", username: "PooYAYooq", revision: 1 });
    expect(await own.query(api.profiles.getEditorProfile, {})).toMatchObject({
      username: "PooYAYooq",
      usernameRevision: 1,
      identityRevision: 0,
      selectionRevision: 0,
    });
    expect(await own.query(api.users.getCurrentUser, {})).toMatchObject({
      username: "PooYAYooq",
      usernameLower: "pooyayooq",
      usernameRevision: 1,
    });
    expect(await claims(t)).toEqual([
      expect.objectContaining({
        usernameLower: "pooyayooq",
        ownerUserId,
        createdAt: START,
      }),
    ]);
    expect(await allowance(t, ownerUserId)).toMatchObject({
      value: 0,
      ts: START,
    });
  });

  it.each([
    "ab",
    "a".repeat(31),
    "naïve",
    "123",
    "_name",
    "name_",
    "a__b",
    "name-x",
    "",
  ])(
    "rejects invalid input %j without consuming a token or writing",
    async (username) => {
      const t = setup();
      const { own, ownerUserId } = await signedIn(t);
      const before = await allowance(t, ownerUserId);
      await expect(
        own.mutation(api.usernames.claimUsername, {
          username,
          expectedRevision: 0,
        }),
      ).rejects.toMatchObject({ data: { field: "username" } });
      expect(await allowance(t, ownerUserId)).toEqual(before);
      expect(await claims(t)).toEqual([]);
      expect(await own.query(api.profiles.getEditorProfile, {})).toMatchObject({
        username: null,
        usernameRevision: 0,
      });
    },
  );

  it.each(["1ab", "a".repeat(30), "a_b"])(
    "accepts boundary spelling %j",
    async (username) => {
      const { own } = await signedIn(setup());
      expect(
        await own.mutation(api.usernames.claimUsername, {
          username,
          expectedRevision: 0,
        }),
      ).toEqual({ kind: "saved", username, revision: 1 });
    },
  );

  it("keeps reserved, foreign-owned, and retired names equally unavailable without burning allowance", async () => {
    const t = setup();
    const first = await signedIn(t, "holder@example.com");
    await first.own.mutation(api.usernames.claimUsername, {
      username: "Pooya",
      expectedRevision: 0,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("usernameClaims", {
        usernameLower: "retired",
        createdAt: START,
      });
    });
    const { own, ownerUserId } = await signedIn(t, "checker@example.com");
    const before = await allowance(t, ownerUserId);
    for (const username of ["Resonance", "POOYA", "Retired"]) {
      expect(
        await own.mutation(api.usernames.claimUsername, {
          username,
          expectedRevision: 0,
        }),
      ).toEqual({ kind: "unavailable" });
      expect(
        await own.query(api.usernames.checkUsernameAvailability, { username }),
      ).toEqual({ status: "taken" });
      expect(
        await t.query(api.usernames.checkUsernameAvailability, { username }),
      ).toEqual({ status: "taken" });
    }
    expect(await allowance(t, ownerUserId)).toEqual(before);
    expect(
      await own.mutation(api.usernames.claimUsername, {
        username: "free_name",
        expectedRevision: 0,
      }),
    ).toEqual({ kind: "saved", username: "free_name", revision: 1 });
  });

  it("availability never reserves names or allowance and exposes only minimal outcomes", async () => {
    const t = setup();
    const { own, ownerUserId } = await signedIn(t);
    const before = await allowance(t, ownerUserId);
    for (let i = 0; i < 3; i++) {
      expect(
        await own.query(api.usernames.checkUsernameAvailability, {
          username: "free_name",
        }),
      ).toEqual({ status: "available" });
      expect(
        await t.query(api.usernames.checkUsernameAvailability, {
          username: "pooya-k",
        }),
      ).toEqual({
        status: "invalid",
        message: "Use only English letters, numbers, and underscores.",
      });
    }
    expect(await claims(t)).toEqual([]);
    expect(await allowance(t, ownerUserId)).toEqual(before);
    const other = await signedIn(t, "other@example.com");
    expect(
      await other.own.mutation(api.usernames.claimUsername, {
        username: "free_name",
        expectedRevision: 0,
      }),
    ).toMatchObject({ kind: "saved" });
    expect(
      await own.query(api.usernames.checkUsernameAvailability, {
        username: "free_name",
      }),
    ).toEqual({ status: "taken" });
  });

  it("preserves the original eligibility through styling, unchanged saves, retries and auth sync", async () => {
    const t = setup();
    const { own, ownerUserId } = await signedIn(t);
    await own.mutation(api.usernames.claimUsername, {
      username: "pooya",
      expectedRevision: 0,
    });
    const before = await allowance(t, ownerUserId);
    vi.setSystemTime(START + 1000);
    expect(
      await own.mutation(api.usernames.claimUsername, {
        username: "Pooya",
        expectedRevision: 1,
      }),
    ).toEqual({ kind: "saved", username: "Pooya", revision: 2 });
    const savedUser = await own.query(api.users.getCurrentUser, {});
    const savedClaims = await claims(t);
    for (const expectedRevision of [2, 1, 0]) {
      expect(
        await own.mutation(api.usernames.claimUsername, {
          username: "Pooya",
          expectedRevision,
        }),
      ).toEqual({ kind: "saved", username: "Pooya", revision: 2 });
    }
    expect(await own.query(api.users.getCurrentUser, {})).toEqual(savedUser);
    expect(await claims(t)).toEqual(savedClaims);
    await own.mutation(api.users.syncUser, {});
    expect(await allowance(t, ownerUserId)).toEqual(before);
    expect(
      await own.mutation(api.usernames.claimUsername, {
        username: "new_name",
        expectedRevision: 2,
      }),
    ).toEqual({
      kind: "cooldown",
      retryAfterMs: USERNAME_CLAIM_PERIOD_MS - 1000,
    });
    expect(await allowance(t, ownerUserId)).toEqual(before);
  });

  it("rejects a stale different target including stale case changes without writing", async () => {
    const t = setup();
    const { own, ownerUserId } = await signedIn(t);
    await own.mutation(api.usernames.claimUsername, {
      username: "first_name",
      expectedRevision: 0,
    });
    const before = await own.query(api.users.getCurrentUser, {});
    const quota = await allowance(t, ownerUserId);
    for (const username of ["second_name", "FIRST_NAME"]) {
      expect(
        await own.mutation(api.usernames.claimUsername, {
          username,
          expectedRevision: 0,
        }),
      ).toEqual({ kind: "conflict" });
    }
    expect(await own.query(api.users.getCurrentUser, {})).toEqual(before);
    expect(await allowance(t, ownerUserId)).toEqual(quota);
    expect(await claims(t)).toHaveLength(1);
  });

  it.each([-1, 0.5, Infinity, NaN])(
    "validates revision %s even on an exact saved-target retry",
    async (expectedRevision) => {
      const t = setup();
      const { own } = await signedIn(t);
      await own.mutation(api.usernames.claimUsername, {
        username: "first_name",
        expectedRevision: 0,
      });
      await expect(
        own.mutation(api.usernames.claimUsername, {
          username: "first_name",
          expectedRevision,
        }),
      ).rejects.toThrow("Invalid revision");
    },
  );

  it("validates input even when its revision is stale", async () => {
    const { own } = await signedIn(setup());
    await own.mutation(api.usernames.claimUsername, {
      username: "first_name",
      expectedRevision: 0,
    });
    await expect(
      own.mutation(api.usernames.claimUsername, {
        username: "bad-name",
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ data: { field: "username" } });
  });

  it("denies just before 90 days, accepts at expiry, and never banks multiple claims", async () => {
    const t = setup();
    const { own } = await signedIn(t);
    await own.mutation(api.usernames.claimUsername, {
      username: "first_name",
      expectedRevision: 0,
    });
    vi.setSystemTime(START + USERNAME_CLAIM_PERIOD_MS - 1);
    const justBefore = await own.mutation(api.usernames.claimUsername, {
      username: "second_name",
      expectedRevision: 1,
    });
    expect(justBefore.kind).toBe("cooldown");
    if (justBefore.kind !== "cooldown") throw new Error("Expected cooldown");
    // The component calculates fractional tokens using floating-point math.
    expect(justBefore.retryAfterMs).toBeCloseTo(1, 3);
    vi.setSystemTime(START + USERNAME_CLAIM_PERIOD_MS);
    expect(
      await own.mutation(api.usernames.claimUsername, {
        username: "second_name",
        expectedRevision: 1,
      }),
    ).toEqual({ kind: "saved", username: "second_name", revision: 2 });
    vi.setSystemTime(START + 10 * USERNAME_CLAIM_PERIOD_MS);
    expect(
      await own.mutation(api.usernames.claimUsername, {
        username: "third_name",
        expectedRevision: 2,
      }),
    ).toMatchObject({ kind: "saved", revision: 3 });
    const afterIdle = await own.mutation(api.usernames.claimUsername, {
      username: "fourth_name",
      expectedRevision: 3,
    });
    expect(afterIdle.kind).toBe("cooldown");
    if (afterIdle.kind !== "cooldown") throw new Error("Expected cooldown");
    expect(afterIdle.retryAfterMs).toBeCloseTo(USERNAME_CLAIM_PERIOD_MS, 3);
  });

  it("switches a to b to a during cooldown while retaining both claims and eligibility", async () => {
    const t = setup();
    const { own, ownerUserId } = await signedIn(t);
    await own.mutation(api.usernames.claimUsername, {
      username: "first_name",
      expectedRevision: 0,
    });
    vi.setSystemTime(START + USERNAME_CLAIM_PERIOD_MS);
    await own.mutation(api.usernames.claimUsername, {
      username: "second_name",
      expectedRevision: 1,
    });
    const before = await allowance(t, ownerUserId);
    vi.setSystemTime(START + USERNAME_CLAIM_PERIOD_MS + 1000);
    expect(
      await own.query(api.usernames.checkUsernameAvailability, {
        username: "FIRST_NAME",
      }),
    ).toEqual({ status: "owned" });
    expect(
      await own.mutation(api.usernames.claimUsername, {
        username: "First_Name",
        expectedRevision: 2,
      }),
    ).toEqual({ kind: "saved", username: "First_Name", revision: 3 });
    expect(
      await own.query(api.usernames.checkUsernameAvailability, {
        username: "FIRST_NAME",
      }),
    ).toEqual({ status: "current" });
    expect(
      await own.query(api.usernames.checkUsernameAvailability, {
        username: "SECOND_NAME",
      }),
    ).toEqual({ status: "owned" });
    expect(await allowance(t, ownerUserId)).toEqual(before);
    expect(
      await own.mutation(api.usernames.claimUsername, {
        username: "third_name",
        expectedRevision: 3,
      }),
    ).toEqual({
      kind: "cooldown",
      retryAfterMs: USERNAME_CLAIM_PERIOD_MS - 1000,
    });
    const other = await signedIn(t, "other@example.com");
    for (const username of ["first_name", "second_name"]) {
      expect(
        await other.own.mutation(api.usernames.claimUsername, {
          username,
          expectedRevision: 0,
        }),
      ).toEqual({ kind: "unavailable" });
    }
    expect(
      (await claims(t)).map((claim) => claim.usernameLower).sort(),
    ).toEqual(["first_name", "second_name"]);
  });

  it("allows only one same-account concurrent new target and isolates other accounts", async () => {
    const t = setup();
    const { own } = await signedIn(t);
    const results = await Promise.all(
      ["first_name", "second_name"].map((username) =>
        own.mutation(api.usernames.claimUsername, {
          username,
          expectedRevision: 0,
        }),
      ),
    );
    expect(results.map((result) => result.kind).sort()).toEqual([
      "conflict",
      "saved",
    ]);
    expect(await claims(t)).toHaveLength(1);
    const other = await signedIn(t, "other@example.com");
    expect(
      await other.own.mutation(api.usernames.claimUsername, {
        username: "other_name",
        expectedRevision: 0,
      }),
    ).toMatchObject({ kind: "saved" });
  });

  it("awards a canonical name to only one concurrent account without consuming the loser's allowance", async () => {
    const t = setup();
    const accounts = [
      await signedIn(t),
      await signedIn(t, "other@example.com"),
    ];
    const results = await Promise.all(
      accounts.map(({ own }, index) =>
        own.mutation(api.usernames.claimUsername, {
          username: index ? "Pooya" : "pooya",
          expectedRevision: 0,
        }),
      ),
    );
    expect(results.map((result) => result.kind).sort()).toEqual([
      "saved",
      "unavailable",
    ]);
    expect(await claims(t)).toHaveLength(1);
    const loser =
      accounts[results.findIndex((result) => result.kind === "unavailable")];
    expect(
      await loser.own.query(api.profiles.getEditorProfile, {}),
    ).toMatchObject({ username: null, usernameRevision: 0 });
    expect(
      await loser.own.mutation(api.usernames.claimUsername, {
        username: "other_name",
        expectedRevision: 0,
      }),
    ).toMatchObject({ kind: "saved" });
  });

  it("serializes competing new, previous and case-only selections at the same revision", async () => {
    const t = setup();
    const { own } = await signedIn(t);
    await own.mutation(api.usernames.claimUsername, {
      username: "first_name",
      expectedRevision: 0,
    });
    vi.setSystemTime(START + USERNAME_CLAIM_PERIOD_MS);
    await own.mutation(api.usernames.claimUsername, {
      username: "second_name",
      expectedRevision: 1,
    });
    vi.setSystemTime(START + 2 * USERNAME_CLAIM_PERIOD_MS);
    const results = await Promise.all(
      ["third_name", "First_Name", "SECOND_NAME"].map((username) =>
        own.mutation(api.usernames.claimUsername, {
          username,
          expectedRevision: 2,
        }),
      ),
    );
    expect(results.map((result) => result.kind).sort()).toEqual([
      "conflict",
      "conflict",
      "saved",
    ]);
    const saved = results.find((result) => result.kind === "saved");
    if (!saved || saved.kind !== "saved")
      throw new Error("Expected one saved target");
    expect(await own.query(api.profiles.getEditorProfile, {})).toMatchObject({
      username: saved.username,
      usernameRevision: 3,
    });
  });

  it("registers retirement only as an internal mutation", async () => {
    // convex-test accepts internal references directly, so it cannot certify
    // HTTP visibility. Check the registration consumed by Convex instead.
    const { retireAccount } = await import("./usernames");
    expect(retireAccount.isInternal).toBe(true);
    expect(Object.hasOwn(retireAccount, "isPublic")).toBe(false);
  });

  it("keeps every name blocked after the Better Auth account is deleted", async () => {
    const t = setup();
    const { own, ownerUserId } = await signedIn(t, "deleted@example.com");
    await own.mutation(api.usernames.claimUsername, {
      username: "firstname",
      expectedRevision: 0,
    });
    // A distinct new name needs the 90-day allowance to refill; otherwise the
    // second claim is a cooldown and no second permanent row exists to retire.
    vi.setSystemTime(START + USERNAME_CLAIM_PERIOD_MS);
    await own.mutation(api.usernames.claimUsername, {
      username: "secondname",
      expectedRevision: 1,
    });

    // Better Auth only mints the onDelete handle when deletion runs through the
    // app adapter configured with both authFunctions and triggers, so exercise
    // the configured internal.auth.onDelete -> retireAccount callback path
    // instead of the raw component adapter that skips the trigger.
    await t.run(async (ctx) => {
      await authComponent
        .adapter(ctx)({})
        .delete({
          model: "user",
          where: [{ field: "_id", value: ownerUserId }],
        });
    });

    const survivor = await signedIn(t, "survivor@example.com");
    expect(
      await survivor.own.mutation(api.usernames.claimUsername, {
        username: "firstname",
        expectedRevision: 0,
      }),
    ).toEqual({ kind: "unavailable" });
    expect(
      await survivor.own.mutation(api.usernames.claimUsername, {
        username: "secondname",
        expectedRevision: 0,
      }),
    ).toEqual({ kind: "unavailable" });
    // Both names survive as permanent blocks with no live owner, which is the
    // retirement write the raw adapter deletion cannot perform on its own.
    expect(
      (await claims(t)).map((claim) => ({
        usernameLower: claim.usernameLower,
        ownerUserId: claim.ownerUserId ?? null,
      })),
    ).toEqual([
      { usernameLower: "firstname", ownerUserId: null },
      { usernameLower: "secondname", ownerUserId: null },
    ]);
    expect(
      await t.query(api.users.getUserProfile, { userId: ownerUserId }),
    ).toBeNull();
  });

  it("refuses anonymous, missing-profile, and caller-selected owner writes", async () => {
    const t = setup();
    await expect(
      t.mutation(api.usernames.claimUsername, {
        username: "anonymous",
        expectedRevision: 0,
      }),
    ).rejects.toThrow("Unauthorized");
    const { own } = await signedIn(t, "unsynced@example.com", false);
    await expect(
      own.mutation(api.usernames.claimUsername, {
        username: "unsynced",
        expectedRevision: 0,
      }),
    ).rejects.toThrow("Unauthorized");
    const holder = await signedIn(t, "holder@example.com");
    await holder.own.mutation(api.usernames.claimUsername, {
      username: "holder_name",
      expectedRevision: 0,
    });
    const args = {
      username: "Holder_Name",
      expectedRevision: 0,
      ownerUserId: holder.ownerUserId,
    };
    await expect(
      own.mutation(api.usernames.claimUsername, args),
    ).rejects.toThrow();
    expect(
      await holder.own.query(api.profiles.getEditorProfile, {}),
    ).toMatchObject({ username: "holder_name", usernameRevision: 1 });
    expect(await t.query(api.profiles.getEditorProfile, {})).toBeNull();
  });

  it.each(["insert", "patch"] as const)(
    "rolls back the real token, claim and selection when %s fails",
    async (stage) => {
      const t = setup();
      const { own, ownerUserId } = await signedIn(t);
      const quota = await allowance(t, ownerUserId);
      const originalUser = await own.query(api.users.getCurrentUser, {});
      await expect(
        t.run(async (ctx) => {
          const { saveUsername } = await import("./usernameModel");
          const user = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", ownerUserId))
            .unique();
          // Fail only the app write; component token consumption remains real.
          const fault = vi
            .spyOn(ctx.db, stage)
            .mockRejectedValueOnce(new Error(`injected ${stage} failure`));
          try {
            await saveUsername(ctx, user!, 0, "failed_name");
          } finally {
            fault.mockRestore();
          }
        }),
      ).rejects.toThrow(`injected ${stage} failure`);
      expect(await allowance(t, ownerUserId)).toEqual(quota);
      expect(await claims(t)).toEqual([]);
      expect(await own.query(api.users.getCurrentUser, {})).toEqual(
        originalUser,
      );
      expect(
        await own.mutation(api.usernames.claimUsername, {
          username: "success_name",
          expectedRevision: 0,
        }),
      ).toMatchObject({ kind: "saved" });
    },
  );

  it("does not bypass a limiter error", async () => {
    const t = setup();
    const { own, ownerUserId } = await signedIn(t);
    const quota = await allowance(t, ownerUserId);
    const fault = vi
      .spyOn(rateLimiter, "limit")
      .mockRejectedValueOnce(new Error("limiter unavailable"));
    await expect(
      own.mutation(api.usernames.claimUsername, {
        username: "failed_name",
        expectedRevision: 0,
      }),
    ).rejects.toThrow("limiter unavailable");
    fault.mockRestore();
    expect(await allowance(t, ownerUserId)).toEqual(quota);
    expect(await claims(t)).toEqual([]);
    expect(await own.query(api.profiles.getEditorProfile, {})).toMatchObject({
      username: null,
      usernameRevision: 0,
    });
  });

  it("retires in bounded idempotent batches, removes the live profile immediately and resets only its limiter", async () => {
    const t = setup();
    const { own, ownerUserId } = await signedIn(t);
    await own.mutation(api.usernames.claimUsername, {
      username: "current_name",
      expectedRevision: 0,
    });
    const other = await signedIn(t, "other@example.com");
    await other.own.mutation(api.usernames.claimUsername, {
      username: "other_name",
      expectedRevision: 0,
    });
    const otherQuota = await allowance(t, other.ownerUserId);
    await t.run(async (ctx) => {
      for (let i = 0; i < 102; i++)
        await ctx.db.insert("usernameClaims", {
          usernameLower: `old_name_${i}`,
          ownerUserId,
          createdAt: START,
        });
    });
    await t.mutation(internal.usernames.retireAccount, { ownerUserId });
    expect(await own.query(api.profiles.getEditorProfile, {})).toBeNull();
    expect(
      await t.query(api.profiles.getPublicIdentity, { userId: ownerUserId }),
    ).toBeNull();
    const during = await claims(t);
    expect(
      during.filter((claim) => claim.ownerUserId === ownerUserId),
    ).toHaveLength(3);
    for (const claim of during.filter(
      (claim) => claim.usernameLower !== "other_name",
    )) {
      expect(
        await other.own.query(api.usernames.checkUsernameAvailability, {
          username: claim.usernameLower,
        }),
      ).toEqual({ status: "taken" });
    }
    await expect(
      own.mutation(api.usernames.claimUsername, {
        username: "another_name",
        expectedRevision: 1,
      }),
    ).rejects.toThrow("Unauthorized");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(internal.usernames.retireAccount, { ownerUserId });
    expect(
      (await claims(t)).filter((claim) => claim.ownerUserId === ownerUserId),
    ).toEqual([]);
    expect(await claims(t)).toHaveLength(104);
    expect(
      await t.run(
        async (ctx) =>
          await rateLimiter.check(ctx, USERNAME_CLAIM_LIMIT, {
            key: ownerUserId,
          }),
      ),
    ).toEqual({ ok: true });
    expect(await allowance(t, other.ownerUserId)).toEqual(otherQuota);
    // Task 4 tests retirement directly. Remove only this in-memory auth fixture
    // to model a new identity with the same email; callback wiring is Task 5.
    await t.run(
      async (ctx) =>
        await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
          input: {
            model: "user",
            where: [{ field: "_id", value: ownerUserId }],
          },
        }),
    );
    const replacement = await signedIn(t, "ada@example.com");
    for (const username of ["current_name", "old_name_101"]) {
      expect(
        await replacement.own.mutation(api.usernames.claimUsername, {
          username,
          expectedRevision: 0,
        }),
      ).toEqual({ kind: "unavailable" });
    }
  });
});
