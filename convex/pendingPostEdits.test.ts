/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register } from "@convex-dev/better-auth/test";
import { afterEach, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { syncPublishedPostProjection } from "./discoverProjection";

const modules = import.meta.glob("./**/*.ts");
const body = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "A publishable body for the pending update." },
      ],
    },
  ],
});
const proposal = { title: "Pending title", body, tags: ["Technology"] };
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  register(t);
  const identity = await t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Pending author",
          email: "pending@example.com",
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
            token: "pending-session",
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  const owner = t.withIdentity(identity);
  const appUserId = await owner.mutation(api.users.syncUser, {});
  const postId = await t.run(async (ctx) => {
    await ctx.db.patch(appUserId, { publishedPostCount: 1 });
    await ctx.db.insert("stats", { totalPosts: 1 });
    const id = await ctx.db.insert("posts", {
      title: "Live title",
      body,
      tags: ["Technology"],
      authorId: identity.subject,
      status: "published",
      publishedAt: 10,
      createdAt: 5,
      updatedAt: 10,
      commentCount: 3,
      likeCount: 7,
      uniqueViewCount: 12,
    });
    await syncPublishedPostProjection(ctx, id);
    return id;
  });
  async function write(
    operationKind: "save-draft" | "update-post" | "publish",
    expectedUpdatedAt: number,
    nextProposal: {
      title: string;
      body: string;
      tags: string[];
      imageStorageId?: Id<"_storage">;
    } = proposal,
    target = postId,
  ) {
    const reservation = await owner.mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: crypto.randomUUID(),
      operationKind,
      postId: target,
      expectedUpdatedAt,
      proposal: nextProposal,
    });
    return owner.mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal: nextProposal,
    });
  }
  return { t, owner, postId, identity, write };
}

it("saves one private pending draft while the live post and discovery stay unchanged", async () => {
  const { t, owner, postId, write } = await setup();
  const before = await t.run((ctx) => ctx.db.get(postId));
  const saved = await write("save-draft", 10);
  expect(saved).toMatchObject({ kind: "succeeded", postId, status: "draft" });
  expect(await t.run((ctx) => ctx.db.get(postId))).toEqual(before);
  const drafts = await owner.query(api.posts.getDrafts, {
    paginationOpts: { cursor: null, numItems: 12 },
  });
  expect(drafts.page).toHaveLength(1);
  expect(drafts.page[0]).toMatchObject({
    title: "Pending title",
    sourcePostId: postId,
  });
  expect(
    await owner.query(api.posts.getPublishedPostForEditing, { postId }),
  ).toMatchObject({
    _id: postId,
    title: "Pending title",
    updatedAt: saved.kind === "succeeded" ? saved.updatedAt : -1,
  });
  expect(
    await t.query(api.posts.getPostById, { postId: drafts.page[0]._id }),
  ).toBeNull();
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("discoverPosts")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .unique(),
    ),
  ).toMatchObject({ title: "Live title" });
  expect(
    (
      await t.query(api.posts.getDrafts, {
        paginationOpts: { cursor: null, numItems: 12 },
      })
    ).page,
  ).toHaveLength(0);
});

it("updates the same pending draft and refuses stale saves", async () => {
  const { t, owner, write } = await setup();
  const first = await write("save-draft", 10);
  if (first.kind !== "succeeded") throw new Error(first.message);
  const second = await write("save-draft", first.updatedAt, {
    ...proposal,
    title: "Latest pending",
  });
  expect(second).toMatchObject({ kind: "succeeded" });
  expect(
    await write("save-draft", first.updatedAt, {
      ...proposal,
      title: "Stale overwrite",
    }),
  ).toMatchObject({ kind: "failed", category: "conflict" });
  const drafts = await owner.query(api.posts.getDrafts, {
    paginationOpts: { cursor: null, numItems: 12 },
  });
  expect(drafts.page).toHaveLength(1);
  expect(drafts.page[0].title).toBe("Latest pending");
  expect(await t.run((ctx) => ctx.db.query("posts").take(10))).toHaveLength(2);
});

it("publishes pending changes into the original post, preserving identity and engagement", async () => {
  const { t, owner, postId, write } = await setup();
  const saved = await write("save-draft", 10);
  if (saved.kind !== "succeeded") throw new Error(saved.message);
  expect(await write("update-post", saved.updatedAt)).toMatchObject({
    kind: "succeeded",
    postId,
    status: "published",
  });
  expect(await t.run((ctx) => ctx.db.get(postId))).toMatchObject({
    title: "Pending title",
    status: "published",
    publishedAt: 10,
    createdAt: 5,
    commentCount: 3,
    likeCount: 7,
    uniqueViewCount: 12,
  });
  expect(
    (
      await owner.query(api.posts.getDrafts, {
        paginationOpts: { cursor: null, numItems: 12 },
      })
    ).page,
  ).toHaveLength(0);
  expect(await t.run((ctx) => ctx.db.query("posts").take(10))).toHaveLength(1);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("discoverPosts")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .unique(),
    ),
  ).toMatchObject({ title: "Pending title", likeCount: 7, commentCount: 3 });
  expect(
    await t.run((ctx) => ctx.db.query("notifications").take(10)),
  ).toHaveLength(0);
});

it("allows unfinished content to be saved without making it publishable", async () => {
  const { postId, write } = await setup();
  const unfinished = {
    title: "",
    body: JSON.stringify({ format: "blocknote@1", blocks: [] }),
    tags: [],
  };
  const saved = await write("save-draft", 10, unfinished);
  expect(saved).toMatchObject({ kind: "succeeded", postId, status: "draft" });
  if (saved.kind !== "succeeded") throw new Error(saved.message);
  expect(await write("update-post", saved.updatedAt, unfinished)).toMatchObject(
    { kind: "failed", category: "invalid-proposal" },
  );
});

it("deleting the pending draft never deletes or unpublishes its source", async () => {
  const { t, owner, postId, write } = await setup();
  expect(await write("save-draft", 10)).toMatchObject({ kind: "succeeded" });
  const drafts = await owner.query(api.posts.getDrafts, {
    paginationOpts: { cursor: null, numItems: 12 },
  });
  await owner.mutation(api.posts.deleteDraft, { draftId: drafts.page[0]._id });
  expect(await t.run((ctx) => ctx.db.get(postId))).toMatchObject({
    title: "Live title",
    status: "published",
    likeCount: 7,
  });
  expect(
    (
      await owner.query(api.posts.getDrafts, {
        paginationOpts: { cursor: null, numItems: 12 },
      })
    ).page,
  ).toHaveLength(0);
});

it("cannot turn a linked pending draft into a second published post through publishPost", async () => {
  const { t, owner, postId, write } = await setup();
  const saved = await write("save-draft", 10);
  if (saved.kind !== "succeeded") throw new Error(saved.message);
  const drafts = await owner.query(api.posts.getDrafts, {
    paginationOpts: { cursor: null, numItems: 12 },
  });
  expect(
    await write("publish", saved.updatedAt, proposal, drafts.page[0]._id),
  ).toMatchObject({ kind: "succeeded", postId, status: "published" });
  expect(await t.run((ctx) => ctx.db.query("posts").take(10))).toHaveLength(1);
});

it("removes the pending draft when its published source is deleted", async () => {
  vi.useFakeTimers();
  const { t, owner, postId, identity, write } = await setup();
  const pendingCover = await t.run(async (ctx) => {
    const id = await ctx.storage.store(
      new Blob(["pending"], { type: "image/png" }),
    );
    await ctx.db.insert("pendingUploads", {
      userId: identity.subject,
      storageId: id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    return id;
  });
  expect(
    await write("save-draft", 10, {
      ...proposal,
      imageStorageId: pendingCover,
    }),
  ).toMatchObject({ kind: "succeeded" });
  await owner.mutation(api.posts.deletePublishedPost, { postId });
  expect(
    (
      await owner.query(api.posts.getDrafts, {
        paginationOpts: { cursor: null, numItems: 12 },
      })
    ).page,
  ).toHaveLength(0);
  expect(await t.run((ctx) => ctx.db.query("posts").take(10))).toHaveLength(0);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run((ctx) => ctx.storage.getUrl(pendingCover))).toBeNull();
  expect(
    await t.run((ctx) => ctx.db.query("pendingUploads").take(10)),
  ).toHaveLength(0);
});

it("rejects a pending save or read against another author's live post", async () => {
  const { t, owner, postId } = await setup();
  await t.run((ctx) => ctx.db.patch(postId, { authorId: "another-author" }));
  await expect(
    owner.mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "foreign",
      operationKind: "save-draft",
      postId,
      expectedUpdatedAt: 10,
      proposal,
    }),
  ).rejects.toThrow("Write target not found");
  expect(
    await owner.query(api.posts.getPublishedPostForEditing, { postId }),
  ).toBeNull();
});

it("protects live cover bytes while replacing, resaving, and deleting pending media", async () => {
  vi.useFakeTimers();
  const { t, owner, postId, identity, write } = await setup();
  const { liveCover, pendingCover } = await t.run(async (ctx) => {
    const liveCover = await ctx.storage.store(
      new Blob(["live"], { type: "image/png" }),
    );
    const pendingCover = await ctx.storage.store(
      new Blob(["pending"], { type: "image/png" }),
    );
    await ctx.db.patch(postId, { imageStorageId: liveCover });
    await ctx.db.insert("pendingUploads", {
      userId: identity.subject,
      storageId: liveCover,
      postId,
      createdAt: 1,
      expiresAt: Number.MAX_SAFE_INTEGER,
      consumedAt: 10,
    });
    await ctx.db.insert("pendingUploads", {
      userId: identity.subject,
      storageId: pendingCover,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    return { liveCover, pendingCover };
  });
  const first = await write("save-draft", 10, {
    ...proposal,
    imageStorageId: pendingCover,
  });
  if (first.kind !== "succeeded") throw new Error(first.message);
  const second = await write("save-draft", first.updatedAt, {
    ...proposal,
    imageStorageId: liveCover,
  });
  if (second.kind !== "succeeded") throw new Error(second.message);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run((ctx) => ctx.storage.getUrl(liveCover))).not.toBeNull();
  expect(await t.run((ctx) => ctx.storage.getUrl(pendingCover))).toBeNull();
  const drafts = await owner.query(api.posts.getDrafts, {
    paginationOpts: { cursor: null, numItems: 12 },
  });
  await owner.mutation(api.posts.deleteDraft, { draftId: drafts.page[0]._id });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run((ctx) => ctx.storage.getUrl(liveCover))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(postId))).toMatchObject({
    imageStorageId: liveCover,
    title: "Live title",
  });
});

it("publishes saved pending media and cleans only files no longer referenced", async () => {
  vi.useFakeTimers();
  const { t, postId, identity, write } = await setup();
  const { liveCover, pendingCover } = await t.run(async (ctx) => {
    const liveCover = await ctx.storage.store(
      new Blob(["live"], { type: "image/png" }),
    );
    const pendingCover = await ctx.storage.store(
      new Blob(["pending"], { type: "image/png" }),
    );
    await ctx.db.patch(postId, { imageStorageId: liveCover });
    await ctx.db.insert("pendingUploads", {
      userId: identity.subject,
      storageId: liveCover,
      postId,
      createdAt: 1,
      expiresAt: Number.MAX_SAFE_INTEGER,
      consumedAt: 10,
    });
    await ctx.db.insert("pendingUploads", {
      userId: identity.subject,
      storageId: pendingCover,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    return { liveCover, pendingCover };
  });
  const edited = { ...proposal, imageStorageId: pendingCover };
  const saved = await write("save-draft", 10, edited);
  if (saved.kind !== "succeeded") throw new Error(saved.message);
  expect(await t.run((ctx) => ctx.storage.getUrl(liveCover))).not.toBeNull();
  expect(await write("update-post", saved.updatedAt, edited)).toMatchObject({
    kind: "succeeded",
    postId,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run((ctx) => ctx.storage.getUrl(pendingCover))).not.toBeNull();
  expect(await t.run((ctx) => ctx.storage.getUrl(liveCover))).toBeNull();
});

it("preserves a saved pending edit when the live source version changes elsewhere", async () => {
  const { t, owner, postId, write } = await setup();
  const saved = await write("save-draft", 10);
  if (saved.kind !== "succeeded") throw new Error(saved.message);
  await t.run((ctx) =>
    ctx.db.patch(postId, { title: "New live version", updatedAt: 11 }),
  );
  expect(
    await write("save-draft", saved.updatedAt, {
      ...proposal,
      title: "Stale pending save",
    }),
  ).toMatchObject({ kind: "failed", category: "conflict" });
  expect(await write("update-post", saved.updatedAt)).toMatchObject({
    kind: "failed",
    category: "conflict",
  });
  expect(await t.run((ctx) => ctx.db.get(postId))).toMatchObject({
    title: "New live version",
  });
  expect(
    (
      await owner.query(api.posts.getDrafts, {
        paginationOpts: { cursor: null, numItems: 12 },
      })
    ).page,
  ).toHaveLength(1);
});

it("rejects an editor whose pending draft was deleted and recreated at the same timestamp", async () => {
  vi.useFakeTimers();
  const { t, owner, postId, write } = await setup();
  const first = await write("save-draft", 10);
  if (first.kind !== "succeeded") throw new Error(first.message);
  const firstDraft = (
    await owner.query(api.posts.getDrafts, {
      paginationOpts: { cursor: null, numItems: 12 },
    })
  ).page[0];
  await owner.mutation(api.posts.deleteDraft, { draftId: firstDraft._id });
  const recreated = await write("save-draft", 10, {
    ...proposal,
    title: "Recreated pending",
  });
  if (recreated.kind !== "succeeded") throw new Error(recreated.message);
  expect(recreated.updatedAt).toBe(first.updatedAt);
  const stale = await owner.mutation(api.writeAttempts.reserveAttempt, {
    clientRequestId: "stale-deleted-draft",
    operationKind: "save-draft",
    postId,
    expectedUpdatedAt: first.updatedAt,
    expectedPendingDraftId: firstDraft._id,
    proposal,
  });
  expect(
    await owner.mutation(api.posts.saveDraft, {
      attemptId: stale.attemptId,
      proposal,
    }),
  ).toMatchObject({ kind: "failed", category: "conflict" });
  expect(
    (
      await owner.query(api.posts.getDrafts, {
        paginationOpts: { cursor: null, numItems: 12 },
      })
    ).page[0].title,
  ).toBe("Recreated pending");
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});
