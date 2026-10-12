/// <reference types="vite/client" />

import { register } from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const AUTH_CREATED_AT = 1_700_000_000_000;

async function createAuthIdentity(
  t: ReturnType<typeof convexTest>,
  options: { name: string; email: string; createdAt?: number },
) {
  register(t);
  const now = Date.now();
  return await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: options.name,
          email: options.email,
          emailVerified: true,
          createdAt: options.createdAt ?? now,
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

function identityInput(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Ada",
    bio: "",
    countryCode: null as string | null,
    socialProfiles: {},
    joinDateDisplay: "calendar" as const,
    ...overrides,
  };
}

describe("profiles identity API", () => {
  it("initializes joinedAt from the immutable auth creation time", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Ada",
      email: "joined@example.com",
      createdAt: AUTH_CREATED_AT,
    });

    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const profile = await t
      .withIdentity(identity)
      .query(api.profiles.getEditorProfile, {});

    expect(profile?.joinedAt).toBe(AUTH_CREATED_AT);
  });

  it("initializes joinedAt once for a pre-existing record and never moves it", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Legacy",
      email: "legacy-joined@example.com",
      createdAt: AUTH_CREATED_AT,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Legacy",
        bio: "",
        followerCount: 0,
        followingCount: 0,
        unreadNotificationCount: 0,
        publishedPostCount: 0,
        createdAt: 1,
      });
    });

    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const profile = await t
      .withIdentity(identity)
      .query(api.profiles.getEditorProfile, {});

    expect(profile?.joinedAt).toBe(AUTH_CREATED_AT);
  });

  it("preserves the author-owned displayName across later auth syncs", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Provider Name",
      email: "owned@example.com",
    });
    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const before = await t
      .withIdentity(identity)
      .query(api.profiles.getEditorProfile, {});

    const saved = await t
      .withIdentity(identity)
      .mutation(api.profiles.updateIdentity, {
        expectedRevision: before!.identityRevision,
        identity: identityInput({ displayName: "Author-owned name" }),
      });
    expect(saved).toEqual({
      kind: "saved",
      revision: before!.identityRevision + 1,
    });

    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const after = await t
      .withIdentity(identity)
      .query(api.profiles.getEditorProfile, {});
    expect(after?.identity.displayName).toBe("Author-owned name");
  });

  it("rejects unauthenticated reads and writes", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.profiles.getEditorProfile, {})).toBeNull();
    await expect(
      t.mutation(api.profiles.updateIdentity, {
        expectedRevision: 0,
        identity: identityInput(),
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("validates fields and clears optional values", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Ada",
      email: "validate@example.com",
    });
    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const before = await t
      .withIdentity(identity)
      .query(api.profiles.getEditorProfile, {});
    const revision = before!.identityRevision;

    await expect(
      t.withIdentity(identity).mutation(api.profiles.updateIdentity, {
        expectedRevision: revision,
        identity: identityInput({ displayName: "   " }),
      }),
    ).rejects.toThrow(/display name/i);

    await expect(
      t.withIdentity(identity).mutation(api.profiles.updateIdentity, {
        expectedRevision: revision,
        identity: identityInput({ bio: "x".repeat(1001) }),
      }),
    ).rejects.toThrow(/1000/);

    await expect(
      t.withIdentity(identity).mutation(api.profiles.updateIdentity, {
        expectedRevision: revision,
        identity: identityInput({
          socialProfiles: { instagram: "http://instagram.com/ada" },
        }),
      }),
    ).rejects.toThrow(/instagram/i);

    await expect(
      t.withIdentity(identity).mutation(api.profiles.updateIdentity, {
        expectedRevision: revision,
        identity: identityInput({
          socialProfiles: { twitter: "https://x.com/ada" },
        }),
      }),
    ).rejects.toThrow();

    const saved = await t
      .withIdentity(identity)
      .mutation(api.profiles.updateIdentity, {
        expectedRevision: revision,
        identity: identityInput({
          bio: "  First\n\nSecond  ",
          countryCode: "IR",
          socialProfiles: { instagram: "https://instagram.com/ada" },
          joinDateDisplay: "relative",
        }),
      });
    expect(saved).toEqual({ kind: "saved", revision: revision + 1 });

    const after = await t
      .withIdentity(identity)
      .query(api.profiles.getEditorProfile, {});
    expect(after?.identity).toEqual({
      displayName: "Ada",
      bio: "First\n\nSecond",
      countryCode: "IR",
      socialProfiles: { instagram: "https://instagram.com/ada" },
      joinDateDisplay: "relative",
    });
  });

  it("returns a conflict for a stale revision without writing", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Ada",
      email: "conflict@example.com",
    });
    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const before = await t
      .withIdentity(identity)
      .query(api.profiles.getEditorProfile, {});

    await t.withIdentity(identity).mutation(api.profiles.updateIdentity, {
      expectedRevision: before!.identityRevision,
      identity: identityInput({ displayName: "First save" }),
    });

    const stale = await t
      .withIdentity(identity)
      .mutation(api.profiles.updateIdentity, {
        expectedRevision: before!.identityRevision,
        identity: identityInput({ displayName: "Stale save" }),
      });
    expect(stale).toEqual({ kind: "conflict" });

    const after = await t
      .withIdentity(identity)
      .query(api.profiles.getEditorProfile, {});
    expect(after?.identity.displayName).toBe("First save");
    expect(after?.identityRevision).toBe(before!.identityRevision + 1);
  });

  it("exposes public identity without private fields", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "public-author",
        displayName: "Public Author",
        email: "private@example.com",
        bio: "Hello",
        countryCode: "IR",
        socialProfiles: { x: "https://x.com/public" },
        joinedAt: AUTH_CREATED_AT,
        joinDateDisplay: "relative",
        selectedPostIds: [],
        identityRevision: 4,
        selectionRevision: 2,
        followerCount: 3,
        followingCount: 1,
        unreadNotificationCount: 0,
        publishedPostCount: 5,
        createdAt: 1,
      });
    });

    const result = await t.query(api.profiles.getPublicIdentity, {
      userId: "public-author",
    });
    expect(result).toEqual({
      userId: "public-author",
      displayName: "Public Author",
      bio: "Hello",
      avatarUrl: null,
      countryCode: "IR",
      socialProfiles: { x: "https://x.com/public" },
      joinedAt: AUTH_CREATED_AT,
      joinDateDisplay: "relative",
      followerCount: 3,
      followingCount: 1,
      postCount: 5,
    });
    expect(Object.hasOwn(result!, "email")).toBe(false);
    expect(Object.hasOwn(result!, "identityRevision")).toBe(false);
    expect(Object.hasOwn(result!, "selectionRevision")).toBe(false);
    expect(Object.hasOwn(result!, "selectedPostIds")).toBe(false);
  });

  it("returns null public identity for an unknown author", async () => {
    const t = convexTest(schema, modules);
    expect(
      await t.query(api.profiles.getPublicIdentity, { userId: "missing" }),
    ).toBeNull();
  });
});
