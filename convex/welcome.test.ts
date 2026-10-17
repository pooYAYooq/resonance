/// <reference types="vite/client" />

import { register as registerBetterAuth } from "@convex-dev/better-auth/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function signedIn(t: ReturnType<typeof convexTest>, email: string) {
  registerBetterAuth(t);
  // The welcome tests exercise `usernames.claimUsername`, which consumes the
  // rate-limiter component, so it must be registered alongside better-auth.
  registerRateLimiter(t);
  const now = Date.now();
  const identity = await t.run(async (ctx) => {
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
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  const own = t.withIdentity(identity);
  await own.mutation(api.users.syncUser, {});
  return own;
}

describe("welcome state", () => {
  it("is due until it is dismissed", async () => {
    const t = convexTest(schema, modules);
    const own = await signedIn(t, "welcome@example.com");

    const before = await own.query(api.welcome.getWelcomeState, {});
    expect(before?.dismissed).toBe(false);
    expect(before?.username).toMatch(/^Reso_/);

    await own.mutation(api.welcome.dismissWelcome, {});
    const after = await own.query(api.welcome.getWelcomeState, {});
    expect(after?.dismissed).toBe(true);
  });

  it("is idempotent and keeps the first dismissal time", async () => {
    const t = convexTest(schema, modules);
    const own = await signedIn(t, "twice@example.com");
    await own.mutation(api.welcome.dismissWelcome, {});
    const first = await own.query(api.welcome.getWelcomeState, {});
    await own.mutation(api.welcome.dismissWelcome, {});
    expect(await own.query(api.welcome.getWelcomeState, {})).toEqual(first);
  });

  it("reports the current name rather than a stale generated one", async () => {
    const t = convexTest(schema, modules);
    const own = await signedIn(t, "customized@example.com");
    await own.mutation(api.usernames.claimUsername, {
      username: "mychoice",
      expectedRevision: 1,
    });
    const state = await own.query(api.welcome.getWelcomeState, {});
    expect(state?.username).toBe("mychoice");
  });

  it("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.welcome.getWelcomeState, {})).toBeNull();
  });
});
