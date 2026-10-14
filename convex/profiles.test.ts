/// <reference types="vite/client" />

import { register } from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { storeTestImage } from "./testUtils/storage";

const modules = import.meta.glob("./**/*.ts");
const AUTH_CREATED_AT = 1_700_000_000_000;

async function createAuthIdentity(
  t: ReturnType<typeof convexTest>,
  options: { name: string; email: string; createdAt?: number; image?: string },
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
          ...(options.image ? { image: options.image } : {}),
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

  it("enforces the 30-code-point name limit without overwriting a longer stored name", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Ada",
      email: "name-limit@example.com",
    });
    const own = t.withIdentity(identity);
    await own.mutation(api.users.syncUser, {});
    const longName = "L".repeat(40);
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique();
      await ctx.db.patch(user!._id, { displayName: longName });
    });
    const before = await own.query(api.profiles.getEditorProfile, {});
    expect(before?.identity.displayName).toBe(longName);
    await expect(
      own.mutation(api.profiles.updateIdentity, {
        expectedRevision: before!.identityRevision,
        identity: { ...before!.identity, displayName: "😀".repeat(31) },
      }),
    ).rejects.toMatchObject({
      data: { field: "displayName", message: "Use at most 30 characters." },
    });
    const unchanged = await own.query(api.profiles.getEditorProfile, {});
    expect(unchanged?.identity.displayName).toBe(longName);
    expect(unchanged?.identityRevision).toBe(before!.identityRevision);
    await own.mutation(api.profiles.updateIdentity, {
      expectedRevision: before!.identityRevision,
      identity: { ...before!.identity, displayName: "😀".repeat(30) },
    });
    expect(
      (await own.query(api.profiles.getEditorProfile, {}))?.identity
        .displayName,
    ).toBe("😀".repeat(30));
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
    ).rejects.toMatchObject({ data: { field: "displayName" } });

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

const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

async function seedPost(
  t: ReturnType<typeof convexTest>,
  authorId: string,
  options: {
    title: string;
    body?: string;
    publishedAt?: number;
    status?: "published" | "draft";
    cover?: boolean;
  },
): Promise<Id<"posts">> {
  return await t.run(async (ctx) => {
    const status = options.status ?? "published";
    const publishedAt = options.publishedAt ?? 1000;
    const body = options.body ?? "Body text.";
    const imageStorageId =
      options.cover === false
        ? undefined
        : await storeTestImage(
            ctx,
            new Blob([PNG_HEADER], { type: "image/png" }),
          );
    const postId = await ctx.db.insert("posts", {
      title: options.title,
      body,
      tags: [],
      authorId,
      status,
      ...(imageStorageId ? { imageStorageId } : {}),
      ...(status === "published" ? { publishedAt } : {}),
      commentCount: 0,
      likeCount: 3,
      uniqueViewCount: 0,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    });
    if (status === "published") {
      await ctx.db.insert("discoverPosts", {
        postId,
        title: options.title,
        bodyText: body,
        authorId,
        authorName: "Author",
        tags: [],
        ...(imageStorageId ? { imageStorageId } : {}),
        publishedAt,
        commentCount: 0,
        likeCount: 3,
      });
      await ctx.db.insert("discoverPostSearch", {
        postId,
        title: options.title,
        authorId,
        authorName: "Author",
        searchableText: `${options.title}\n${body}\nAuthor`,
      });
    }
    return postId;
  });
}

async function seedPosts(
  t: ReturnType<typeof convexTest>,
  authorId: string,
  count: number,
): Promise<Id<"posts">[]> {
  const ids: Id<"posts">[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(
      await seedPost(t, authorId, {
        title: `Post ${i}`,
        publishedAt: 1000 + i,
      }),
    );
  }
  return ids;
}

/** Drains scheduled work with scoped fake timers so teardown has no pending job. */
async function drainScheduled(t: ReturnType<typeof convexTest>) {
  vi.useFakeTimers();
  try {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
}

async function seedAuthor(
  t: ReturnType<typeof convexTest>,
  email: string,
  postCount: number,
) {
  const identity = await createAuthIdentity(t, { name: "Author", email });
  const userId = await t
    .withIdentity(identity)
    .mutation(api.users.syncUser, {});
  const posts = await seedPosts(t, identity.subject, postCount);
  // Seeded posts bypass the publish lifecycle, so align the maintained counter
  // that deletion decrements.
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { publishedPostCount: postCount });
  });
  return { identity, posts, own: t.withIdentity(identity) };
}

describe("profiles selection API", () => {
  it("saves ordered selections, rejects invalid entries atomically, and reconciles deletion", async () => {
    const t = convexTest(schema, modules);
    const { identity, posts, own } = await seedAuthor(
      t,
      "selection@example.com",
      10,
    );

    const saved = await own.mutation(api.profiles.updateSelection, {
      expectedRevision: 0,
      postIds: [posts[2], posts[0], posts[1]],
    });
    expect(saved).toEqual({ kind: "saved", revision: 1 });

    const showcase = await t.query(api.profiles.getShowcase, {
      userId: identity.subject,
    });
    expect(showcase.mode).toBe("selected");
    expect(showcase.posts.map((post) => post.postId)).toEqual([
      posts[2],
      posts[0],
      posts[1],
    ]);

    const draft = await seedPost(t, identity.subject, {
      title: "Draft post",
      status: "draft",
    });
    const foreign = await seedPost(t, "another-author", {
      title: "Foreign post",
    });

    await expect(
      own.mutation(api.profiles.updateSelection, {
        expectedRevision: 1,
        postIds: posts,
      }),
    ).rejects.toThrow(/at most/i);
    await expect(
      own.mutation(api.profiles.updateSelection, {
        expectedRevision: 1,
        postIds: [posts[0], posts[0]],
      }),
    ).rejects.toThrow(/duplicate/i);
    await expect(
      own.mutation(api.profiles.updateSelection, {
        expectedRevision: 1,
        postIds: [foreign, posts[0]],
      }),
    ).rejects.toThrow(/published/i);
    await expect(
      own.mutation(api.profiles.updateSelection, {
        expectedRevision: 1,
        postIds: [draft, posts[0]],
      }),
    ).rejects.toThrow(/published/i);

    const goneId = await seedPost(t, identity.subject, {
      title: "Gone post",
      status: "draft",
    });
    await t.run(async (ctx) => {
      await ctx.db.delete(goneId);
    });
    await expect(
      own.mutation(api.profiles.updateSelection, {
        expectedRevision: 1,
        postIds: [goneId],
      }),
    ).rejects.toThrow(/published/i);

    const beforeDelete = await own.query(api.profiles.getEditorProfile, {});
    expect(beforeDelete?.selectionRevision).toBe(1);

    await own.mutation(api.posts.deletePublishedPost, { postId: posts[0] });
    await drainScheduled(t);

    const afterDelete = await t.query(api.profiles.getShowcase, {
      userId: identity.subject,
    });
    expect(afterDelete.posts.map((post) => post.postId)).toEqual([
      posts[2],
      posts[1],
    ]);
    const editor = await own.query(api.profiles.getEditorProfile, {});
    expect(editor?.selectionRevision).toBe(2);

    await expect(
      own.mutation(api.profiles.updateSelection, {
        expectedRevision: 1,
        postIds: [posts[1]],
      }),
    ).resolves.toEqual({ kind: "conflict" });
  });

  it("restores the latest-three fallback when the last selection is deleted", async () => {
    const t = convexTest(schema, modules);
    const { identity, posts, own } = await seedAuthor(
      t,
      "fallback@example.com",
      4,
    );

    await own.mutation(api.profiles.updateSelection, {
      expectedRevision: 0,
      postIds: [posts[3]],
    });
    await own.mutation(api.posts.deletePublishedPost, { postId: posts[3] });
    await drainScheduled(t);

    const showcase = await t.query(api.profiles.getShowcase, {
      userId: identity.subject,
    });
    expect(showcase.mode).toBe("latest");
    expect(showcase.posts.map((post) => post.postId)).toEqual([
      posts[2],
      posts[1],
      posts[0],
    ]);
  });

  it("returns only the featured selection without reading a latest fallback", async () => {
    const t = convexTest(schema, modules);
    const { identity, posts, own } = await seedAuthor(
      t,
      "selected-only@example.com",
      4,
    );

    await expect(
      t.query(api.profiles.getSelectedShowcase, { userId: identity.subject }),
    ).resolves.toEqual([]);

    await own.mutation(api.profiles.updateSelection, {
      expectedRevision: 0,
      postIds: [posts[2], posts[0]],
    });
    await expect(
      t.query(api.profiles.getSelectedShowcase, { userId: identity.subject }),
    ).resolves.toMatchObject([
      { postId: posts[2], title: "Post 2" },
      { postId: posts[0], title: "Post 0" },
    ]);

    await own.mutation(api.posts.deletePublishedPost, { postId: posts[2] });
    await drainScheduled(t);
    const remaining = await t.query(api.profiles.getSelectedShowcase, {
      userId: identity.subject,
    });
    expect(remaining.map((post) => post.postId)).toEqual([posts[0]]);
  });

  it("leaves the selection revision unchanged when an unselected post is deleted", async () => {
    const t = convexTest(schema, modules);
    const { posts, own } = await seedAuthor(t, "unselected@example.com", 3);

    await own.mutation(api.profiles.updateSelection, {
      expectedRevision: 0,
      postIds: [posts[1]],
    });
    await own.mutation(api.posts.deletePublishedPost, { postId: posts[0] });
    await drainScheduled(t);

    const editor = await own.query(api.profiles.getEditorProfile, {});
    expect(editor?.selectionRevision).toBe(1);
    expect(editor?.selectedPostIds).toEqual([posts[1]]);
  });

  it("keeps a concurrent selection and deletion consistent", async () => {
    const t = convexTest(schema, modules);
    const { posts, own } = await seedAuthor(t, "concurrent@example.com", 4);

    await own.mutation(api.profiles.updateSelection, {
      expectedRevision: 0,
      postIds: [posts[0], posts[1], posts[2]],
    });

    await Promise.allSettled([
      own.mutation(api.profiles.updateSelection, {
        expectedRevision: 1,
        postIds: [posts[1], posts[2]],
      }),
      own.mutation(api.posts.deletePublishedPost, { postId: posts[2] }),
    ]);
    await drainScheduled(t);

    const editor = await own.query(api.profiles.getEditorProfile, {});
    const selection = editor?.selectedPostIds ?? [];
    expect(selection).not.toContain(posts[2]);
    expect(new Set(selection).size).toBe(selection.length);
    expect(selection).toEqual(
      selection.filter((id) => [posts[0], posts[1]].includes(id)),
    );
  });

  it("resolves live selection availability for the caller's own published posts", async () => {
    const t = convexTest(schema, modules);
    const { identity, posts, own } = await seedAuthor(
      t,
      "availability@example.com",
      10,
    );
    const draft = await seedPost(t, identity.subject, {
      title: "Availability draft",
      status: "draft",
    });
    const foreign = await seedPost(t, "other-author", {
      title: "Availability foreign",
    });

    const available = await own.query(
      api.profiles.getOwnSelectionAvailability,
      { postIds: [posts[3], foreign, draft, posts[1]] },
    );
    expect(available).toEqual([posts[3], posts[1]]);

    await expect(
      t.query(api.profiles.getOwnSelectionAvailability, { postIds: [] }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      own.query(api.profiles.getOwnSelectionAvailability, {
        postIds: posts,
      }),
    ).rejects.toThrow(/at most/i);
    await expect(
      own.query(api.profiles.getOwnSelectionAvailability, {
        postIds: [posts[0], posts[0]],
      }),
    ).rejects.toThrow(/duplicate/i);
  });

  it("paginates author posts without leaking private fields", async () => {
    const t = convexTest(schema, modules);
    const { identity } = await seedAuthor(t, "catalogue@example.com", 5);

    const first = await t.query(api.profiles.listAuthorPosts, {
      userId: identity.subject,
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page).toHaveLength(2);
    expect(first.isDone).toBe(false);

    const next = await t.query(api.profiles.listAuthorPosts, {
      userId: identity.subject,
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    const firstIds = first.page.map((card) => card.postId);
    expect(next.page.map((card) => card.postId)).not.toEqual(
      expect.arrayContaining(firstIds),
    );

    for (const card of first.page) {
      expect(Object.hasOwn(card, "body")).toBe(false);
      expect(Object.hasOwn(card, "bodyText")).toBe(false);
      expect(Object.hasOwn(card, "tags")).toBe(false);
      expect(Object.hasOwn(card, "commentCount")).toBe(false);
      expect(Object.hasOwn(card, "email")).toBe(false);
      expect(Object.hasOwn(card, "isLiked")).toBe(false);
      expect(Object.hasOwn(card, "isBookmarked")).toBe(false);
      expect(Object.hasOwn(card, "identityRevision")).toBe(false);
    }

    await expect(
      t.query(api.profiles.listAuthorPosts, {
        userId: identity.subject,
        paginationOpts: { numItems: 21, cursor: null },
      }),
    ).rejects.toThrow(/page size/i);

    const empty = await t.query(api.profiles.listAuthorPosts, {
      userId: "no-such-author",
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(empty.page).toEqual([]);
  });

  it("bounds explicit cursor ranges in catalogue and empty-search pages", async () => {
    const t = convexTest(schema, modules);
    const { identity, own } = await seedAuthor(
      t,
      "wide-index-range@example.com",
      21,
    );

    const catalogueFirst = await t.query(api.profiles.listAuthorPosts, {
      userId: identity.subject,
      paginationOpts: { numItems: 20, cursor: null },
    });
    const catalogueLast = await t.query(api.profiles.listAuthorPosts, {
      userId: identity.subject,
      paginationOpts: { numItems: 20, cursor: catalogueFirst.continueCursor },
    });
    const catalogueRange = await t.query(api.profiles.listAuthorPosts, {
      userId: identity.subject,
      paginationOpts: {
        numItems: 1,
        cursor: null,
        endCursor: catalogueLast.continueCursor,
      },
    });

    expect(catalogueRange.page).toHaveLength(20);
    expect(catalogueRange.pageStatus).toBe("SplitRequired");
    expect(catalogueRange.splitCursor).toEqual(expect.any(String));

    const browseFirst = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "",
      paginationOpts: { numItems: 20, cursor: null },
    });
    const browseLast = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "",
      paginationOpts: { numItems: 20, cursor: browseFirst.continueCursor },
    });
    const browseRange = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "",
      paginationOpts: {
        numItems: 1,
        cursor: null,
        endCursor: browseLast.continueCursor,
      },
    });

    expect(browseRange.page).toHaveLength(20);
    expect(browseRange.pageStatus).toBe("SplitRequired");
    expect(browseRange.splitCursor).toEqual(expect.any(String));
  });

  it("searches only the author's own titles and refuses anonymous pickers", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Picker Owner",
      email: "picker-owner@example.com",
    });
    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const own = t.withIdentity(identity);
    const matchId = await seedPost(t, identity.subject, {
      title: "Quokka sightings",
      body: "No keyword here.",
      publishedAt: 10,
    });
    const bodyOnlyId = await seedPost(t, identity.subject, {
      title: "Plain heading",
      body: "This body mentions Quokka but the title does not.",
      publishedAt: 11,
    });

    await expect(
      t.query(api.profiles.listOwnPublishedPosts, {
        search: "",
        paginationOpts: { numItems: 5, cursor: null },
      }),
    ).rejects.toThrow("Unauthorized");

    const browsed = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "   ",
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(browsed.page.map((card) => card.postId)).toContain(matchId);

    const searched = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "Quokka",
      paginationOpts: { numItems: 5, cursor: null },
    });
    const searchedIds = searched.page.map((card) => card.postId);
    expect(searchedIds).toContain(matchId);
    expect(searchedIds).not.toContain(bodyOnlyId);

    await expect(
      own.query(api.profiles.listOwnPublishedPosts, {
        search: "x".repeat(101),
        paginationOpts: { numItems: 5, cursor: null },
      }),
    ).rejects.toThrow(/too long/i);
  });

  it("refuses explicit end cursor ranges on title search before reading the index", async () => {
    const t = convexTest(schema, modules);
    const { own } = await seedAuthor(t, "wide-title-range@example.com", 21);

    const firstPage = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "Post",
      paginationOpts: { numItems: 20, cursor: null },
    });
    const secondPage = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "Post",
      paginationOpts: { numItems: 20, cursor: firstPage.continueCursor },
    });

    // Refused even for a range a size check would accept, so the guard cannot
    // be satisfied by reading the range first.
    await expect(
      own.query(api.profiles.listOwnPublishedPosts, {
        search: "Post",
        paginationOpts: {
          numItems: 1,
          cursor: null,
          endCursor: firstPage.continueCursor,
        },
      }),
    ).rejects.toThrow(/end cursor/i);

    // A caller-supplied read budget cannot make the range acceptable either.
    await expect(
      own.query(api.profiles.listOwnPublishedPosts, {
        search: "Post",
        paginationOpts: {
          numItems: 1,
          cursor: null,
          endCursor: secondPage.continueCursor,
          maximumRowsRead: 20,
        },
      }),
    ).rejects.toThrow(/end cursor/i);

    // Plain cursor pagination and an explicit null end cursor still work.
    const nextPage = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "Post",
      paginationOpts: {
        numItems: 20,
        cursor: firstPage.continueCursor,
        endCursor: null,
      },
    });
    expect(nextPage.page.length).toBeGreaterThan(0);
  });
});

describe("profiles API edge coverage", () => {
  it.each(["", "Quokka"])(
    "omits coverless picker results for search %j",
    async (search) => {
      const t = convexTest(schema, modules);
      const { identity, own } = await seedAuthor(t, "eligible@example.com", 0);
      const covered = await seedPost(t, identity.subject, {
        title: "Quokka with cover",
        publishedAt: 10,
      });
      await seedPost(t, identity.subject, {
        title: "Quokka without cover",
        publishedAt: 20,
        cover: false,
      });

      const result = await own.query(api.profiles.listOwnPublishedPosts, {
        search,
        paginationOpts: { numItems: 5, cursor: null },
      });
      expect(result.page.map((card) => card.postId)).toEqual([covered]);
      await expect(
        own.mutation(api.profiles.updateSelection, {
          expectedRevision: 0,
          postIds: result.page.map((card) => card.postId),
        }),
      ).resolves.toEqual({ kind: "saved", revision: 1 });
    },
  );

  it.each(["", "Post"])(
    "preserves cursor progress through an empty eligible page for search %j",
    async (search) => {
      const t = convexTest(schema, modules);
      const { own, posts } = await seedAuthor(t, "short-page@example.com", 3);
      const firstBefore = await own.query(api.profiles.listOwnPublishedPosts, {
        search,
        paginationOpts: { numItems: 1, cursor: null },
      });
      const coverless = firstBefore.page[0].postId;
      await t.run(async (ctx) => {
        await ctx.db.patch(coverless, { imageStorageId: undefined });
        const summary = await ctx.db
          .query("discoverPosts")
          .withIndex("by_postId", (q) => q.eq("postId", coverless))
          .unique();
        await ctx.db.patch(summary!._id, { imageStorageId: undefined });
      });

      const first = await own.query(api.profiles.listOwnPublishedPosts, {
        search,
        paginationOpts: { numItems: 1, cursor: null },
      });
      expect(first.page).toEqual([]);
      expect(first.isDone).toBe(false);
      expect(first.continueCursor).toBe(firstBefore.continueCursor);

      const found: Id<"posts">[] = [];
      let page = first;
      for (let i = 0; i < 4 && !page.isDone; i++) {
        page = await own.query(api.profiles.listOwnPublishedPosts, {
          search,
          paginationOpts: { numItems: 1, cursor: page.continueCursor },
        });
        found.push(...page.page.map((card) => card.postId));
      }
      expect(page.isDone).toBe(true);
      expect(found.sort()).toEqual(
        posts.filter((id) => id !== coverless).sort(),
      );
    },
  );

  it.each(["", "Post"])(
    "keeps a stored-cover picker result with an unavailable image URL for search %j",
    async (search) => {
      const t = convexTest(schema, modules);
      const { own, posts } = await seedAuthor(
        t,
        "missing-image@example.com",
        1,
      );
      await t.run(async (ctx) => {
        const post = await ctx.db.get(posts[0]);
        await ctx.storage.delete(post!.imageStorageId!);
      });

      const result = await own.query(api.profiles.listOwnPublishedPosts, {
        search,
        paginationOpts: { numItems: 5, cursor: null },
      });
      expect(result.page).toEqual([
        { postId: posts[0], title: "Post 0", imageUrl: null, likeCount: 3 },
      ]);
      await expect(
        own.mutation(api.profiles.updateSelection, {
          expectedRevision: 0,
          postIds: [posts[0]],
        }),
      ).resolves.toEqual({ kind: "saved", revision: 1 });
    },
  );

  it("rejects selecting a published post without a stored cover", async () => {
    const t = convexTest(schema, modules);
    const { identity, own } = await seedAuthor(t, "no-cover@example.com", 1);
    const noCover = await seedPost(t, identity.subject, {
      title: "No cover",
      publishedAt: 50,
      cover: false,
    });

    await expect(
      own.mutation(api.profiles.updateSelection, {
        expectedRevision: 0,
        postIds: [noCover],
      }),
    ).rejects.toThrow(/cover/i);

    const editor = await own.query(api.profiles.getEditorProfile, {});
    expect(editor?.selectionRevision).toBe(0);
    expect(editor?.selectedPostIds).toEqual([]);
  });

  it("advances identityRevision when the provider avatar changes", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Ada",
      email: "avatar@example.com",
      image: "https://provider.example/current.png",
    });
    const userId = await t
      .withIdentity(identity)
      .mutation(api.users.syncUser, {});
    expect(
      (await t.withIdentity(identity).query(api.profiles.getEditorProfile, {}))
        ?.identityRevision,
    ).toBe(0);

    // Simulate a previously stored avatar that differs from the provider one.
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        avatarUrl: "https://provider.example/stale.png",
      });
    });
    await t.withIdentity(identity).mutation(api.users.syncUser, {});

    const after = await t
      .withIdentity(identity)
      .query(api.profiles.getEditorProfile, {});
    expect(after?.identityRevision).toBe(1);
  });

  it("drops a deleted post from live selection availability", async () => {
    const t = convexTest(schema, modules);
    const { posts, own } = await seedAuthor(
      t,
      "availability-delete@example.com",
      3,
    );

    const before = await own.query(api.profiles.getOwnSelectionAvailability, {
      postIds: [posts[0], posts[1]],
    });
    expect(before).toEqual([posts[0], posts[1]]);

    await own.mutation(api.posts.deletePublishedPost, { postId: posts[0] });
    await drainScheduled(t);

    const after = await own.query(api.profiles.getOwnSelectionAvailability, {
      postIds: [posts[0], posts[1]],
    });
    expect(after).toEqual([posts[1]]);
  });

  it("keeps a coverless published post available instead of treating it as gone", async () => {
    const t = convexTest(schema, modules);
    const { identity, own } = await seedAuthor(
      t,
      "availability-coverless@example.com",
      0,
    );
    const coverless = await seedPost(t, identity.subject, {
      title: "Legacy coverless",
      publishedAt: 12,
      cover: false,
    });

    await expect(
      own.query(api.profiles.getOwnSelectionAvailability, {
        postIds: [coverless],
      }),
    ).resolves.toEqual([coverless]);
  });

  it("drops a search hit whose compact summary is gone", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Ada",
      email: "stale-hit@example.com",
    });
    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const own = t.withIdentity(identity);
    const postId = await seedPost(t, identity.subject, {
      title: "Stale Zebra",
      publishedAt: 5,
    });

    await t.run(async (ctx) => {
      const summary = await ctx.db
        .query("discoverPosts")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .unique();
      if (summary) await ctx.db.delete(summary._id);
    });

    const result = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "Zebra",
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(result.page).toEqual([]);
  });

  it("reflects a changed title in the picker search", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Ada",
      email: "renamed-title@example.com",
    });
    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const own = t.withIdentity(identity);
    const postId = await seedPost(t, identity.subject, {
      title: "Alpha Gorilla",
      publishedAt: 6,
    });

    await t.run(async (ctx) => {
      const summary = await ctx.db
        .query("discoverPosts")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .unique();
      if (summary) await ctx.db.patch(summary._id, { title: "Beta Gorilla" });
      const searchRow = await ctx.db
        .query("discoverPostSearch")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .unique();
      if (searchRow)
        await ctx.db.patch(searchRow._id, { title: "Beta Gorilla" });
    });

    const renamed = await own.query(api.profiles.listOwnPublishedPosts, {
      search: "Beta",
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(renamed.page.map((card) => card.postId)).toContain(postId);
  });

  it("keeps native order for tied publication times without overlapping pages", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Ada",
      email: "tied@example.com",
    });
    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const first = await seedPost(t, identity.subject, {
      title: "Tied A",
      publishedAt: 7,
    });
    const second = await seedPost(t, identity.subject, {
      title: "Tied B",
      publishedAt: 7,
    });

    const page1 = await t.query(api.profiles.listAuthorPosts, {
      userId: identity.subject,
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(page1.isDone).toBe(false);
    expect(typeof page1.continueCursor).toBe("string");
    const page2 = await t.query(api.profiles.listAuthorPosts, {
      userId: identity.subject,
      paginationOpts: { numItems: 1, cursor: page1.continueCursor },
    });

    const seen = [page1.page[0]?.postId, page2.page[0]?.postId];
    expect(new Set(seen)).toEqual(new Set([first, second]));
  });

  it("rejects oversized auxiliary pagination read budgets", async () => {
    const t = convexTest(schema, modules);
    const { identity, own } = await seedAuthor(
      t,
      "pagination-limit@example.com",
      1,
    );

    await expect(
      t.query(api.profiles.listAuthorPosts, {
        userId: identity.subject,
        paginationOpts: { numItems: 5, cursor: null, maximumRowsRead: 21 },
      }),
    ).rejects.toThrow(/page size/i);
    await expect(
      own.query(api.profiles.listOwnPublishedPosts, {
        search: "",
        paginationOpts: { numItems: 5, cursor: null, maximumRowsRead: 21 },
      }),
    ).rejects.toThrow(/page size/i);
  });

  it("preserves saved identity fields across successive revision-checked saves", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthIdentity(t, {
      name: "Provider",
      email: "successive-saves@example.com",
    });
    await t.withIdentity(identity).mutation(api.users.syncUser, {});
    const own = t.withIdentity(identity);

    const before = await own.query(api.profiles.getEditorProfile, {});
    await own.mutation(api.profiles.updateIdentity, {
      expectedRevision: before!.identityRevision,
      identity: identityInput({
        countryCode: "IR",
        joinDateDisplay: "relative",
        bio: "Original introduction",
      }),
    });

    const mid = await own.query(api.profiles.getEditorProfile, {});
    await own.mutation(api.profiles.updateIdentity, {
      expectedRevision: mid!.identityRevision,
      identity: {
        ...mid!.identity,
        displayName: "Second save name",
        bio: "Second save introduction",
      },
    });

    const after = await own.query(api.profiles.getEditorProfile, {});
    expect(after?.identity).toMatchObject({
      displayName: "Second save name",
      bio: "Second save introduction",
      countryCode: "IR",
      joinDateDisplay: "relative",
    });
    expect(after?.identityRevision).toBe(mid!.identityRevision + 1);

    await expect(
      own.mutation(api.profiles.updateIdentity, {
        expectedRevision: after!.identityRevision,
        identity: identityInput({ displayName: "   " }),
      }),
    ).rejects.toMatchObject({ data: { field: "displayName" } });
  });
});
