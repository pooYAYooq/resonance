/**
 * Unit tests for Convex post queries and mutations.
 * Covers the structured-only publish body contract, inline upload claims,
 * auth rejection, pagination, image URL resolution, comment counting, and the
 * authenticated-owner test harness limitation because `safeGetAuthUser` uses
 * the Better Auth component (see convex/bookmarks.test.ts:1-12).
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { isValidPostTags } from "../lib/constants/post-tags";
import {
  BLOCKNOTE_FORMAT,
  extractImageStorageIds,
  MIN_POST_TEXT_LENGTH,
  MAX_POST_TEXT_LENGTH,
} from "../lib/post-content";
import {
  isValidDraftPostBody,
  isValidPublishPostBody,
  validateInlineUploadClaims,
} from "./posts";
import {
  getPostStatus,
  getPublishedAt,
  getPublishedPost,
  requirePublishedPost,
} from "./postLifecycle";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

describe("posts functions", () => {
  it("normalizes legacy lifecycle fields without hiding drafts", () => {
    expect(getPostStatus({ status: undefined })).toBe("published");
    expect(getPostStatus({ status: "draft" })).toBe("draft");
    expect(
      getPublishedAt({
        status: undefined,
        publishedAt: undefined,
        createdAt: 42,
      }),
    ).toBe(42);
    expect(
      getPublishedAt({
        status: "published",
        publishedAt: undefined,
        createdAt: 42,
      }),
    ).toBe(42);
    expect(
      getPublishedAt({ status: "published", publishedAt: 99, createdAt: 42 }),
    ).toBe(99);
    expect(
      getPublishedAt({
        status: "draft",
        publishedAt: undefined,
        createdAt: 42,
      }),
    ).toBeUndefined();
  });

  it("uses one generic published-post contract for missing and draft rows", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const legacy = await ctx.db.insert("posts", {
        title: "Legacy",
        body: "Legacy body",
        authorId: "author-1",
        commentCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const published = await ctx.db.insert("posts", {
        title: "Published",
        body: "Published body",
        authorId: "author-1",
        status: "published",
        publishedAt: 2,
        commentCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
      const draft = await ctx.db.insert("posts", {
        title: "Draft",
        body: "Draft body",
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        createdAt: 3,
        updatedAt: 3,
      });
      const missing = await ctx.db.insert("posts", {
        title: "Missing",
        body: "Missing body",
        authorId: "author-1",
        commentCount: 0,
        createdAt: 4,
        updatedAt: 4,
      });
      await ctx.db.delete(missing);
      return { legacy, published, draft, missing };
    });

    await t.run(async (ctx) => {
      await expect(getPublishedPost(ctx, ids.legacy)).resolves.toMatchObject({
        _id: ids.legacy,
      });
      await expect(getPublishedPost(ctx, ids.published)).resolves.toMatchObject(
        {
          _id: ids.published,
        },
      );
      await expect(getPublishedPost(ctx, ids.draft)).resolves.toBeNull();
      await expect(getPublishedPost(ctx, ids.missing)).resolves.toBeNull();
      await expect(requirePublishedPost(ctx, ids.draft)).rejects.toThrow(
        "Post not found.",
      );
      await expect(requirePublishedPost(ctx, ids.missing)).rejects.toThrow(
        "Post not found.",
      );
    });
  });

  it("hides draft rows from global, author, and detail reads", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => ({
      legacy: await ctx.db.insert("posts", {
        title: "Legacy",
        body: "Legacy body",
        authorId: "author-1",
        commentCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
      published: await ctx.db.insert("posts", {
        title: "Published",
        body: "Published body",
        authorId: "author-1",
        status: "published",
        publishedAt: 2,
        commentCount: 0,
        createdAt: 2,
        updatedAt: 2,
      }),
      draft: await ctx.db.insert("posts", {
        title: "Draft",
        body: "Draft body",
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        createdAt: 3,
        updatedAt: 3,
      }),
    }));

    const global = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(global.page.map((post) => post.title)).toEqual([
      "Published",
      "Legacy",
    ]);

    const author = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "author-1",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(author.page.map((post) => post.title)).toEqual([
      "Published",
      "Legacy",
    ]);
    expect(
      await t.query(api.posts.getPostById, { postId: ids.draft }),
    ).toBeNull();
    expect(
      (await t.query(api.posts.getPostById, { postId: ids.published }))?.title,
    ).toBe("Published");
    expect(
      (await t.query(api.posts.getPostById, { postId: ids.legacy }))?.title,
    ).toBe("Legacy");
  });

  it("backfills legacy posts in bounded, idempotent pages", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const ids = await t.run(async (ctx) => {
        const legacyFirst = await ctx.db.insert("posts", {
          title: "Legacy first",
          body: "legacy body 1",
          authorId: "author-1",
          commentCount: 0,
          createdAt: 10,
          updatedAt: 11,
        });
        const publishedWithoutTimestamp = await ctx.db.insert("posts", {
          title: "Published without timestamp",
          body: "legacy body 2",
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          createdAt: 20,
          updatedAt: 21,
        });
        const draft = await ctx.db.insert("posts", {
          title: "Draft",
          body: "draft body",
          authorId: "author-1",
          status: "draft",
          commentCount: 0,
          createdAt: 30,
          updatedAt: 31,
        });
        const normalized = await ctx.db.insert("posts", {
          title: "Normalized",
          body: "normalized body",
          authorId: "author-1",
          status: "published",
          publishedAt: 40,
          commentCount: 0,
          createdAt: 40,
          updatedAt: 41,
        });
        const legacySecond = await ctx.db.insert("posts", {
          title: "Legacy second",
          body: "legacy body 3",
          authorId: "author-1",
          commentCount: 0,
          createdAt: 50,
          updatedAt: 51,
        });
        return {
          legacyFirst,
          publishedWithoutTimestamp,
          draft,
          normalized,
          legacySecond,
        };
      });

      const firstPage = await t.mutation(
        internal.postLifecycle.backfillPublishedPosts,
        {
          paginationOpts: { numItems: 2, cursor: null },
        },
      );
      expect(firstPage).toMatchObject({ done: false, processed: 2 });

      await t.finishAllScheduledFunctions(vi.runAllTimers);

      const afterBackfill = await t.run(async (ctx) =>
        Promise.all(
          [
            ids.legacyFirst,
            ids.publishedWithoutTimestamp,
            ids.draft,
            ids.normalized,
            ids.legacySecond,
          ].map((id) => ctx.db.get(id)),
        ),
      );
      expect(afterBackfill[0]).toMatchObject({
        status: "published",
        publishedAt: 10,
      });
      expect(afterBackfill[1]).toMatchObject({
        status: "published",
        publishedAt: 20,
      });
      expect(afterBackfill[2]).toMatchObject({ status: "draft" });
      expect(afterBackfill[2]?.publishedAt).toBeUndefined();
      expect(afterBackfill[3]).toMatchObject({
        status: "published",
        publishedAt: 40,
      });
      expect(afterBackfill[4]).toMatchObject({
        status: "published",
        publishedAt: 50,
      });
      expect(afterBackfill.map((post) => post?.updatedAt)).toEqual([
        11, 21, 31, 41, 51,
      ]);
      expect(afterBackfill.map((post) => post?.body)).toEqual([
        "legacy body 1",
        "legacy body 2",
        "draft body",
        "normalized body",
        "legacy body 3",
      ]);

      const beforeRetry = afterBackfill.map((post) => ({
        status: post?.status,
        publishedAt: post?.publishedAt,
        updatedAt: post?.updatedAt,
        body: post?.body,
      }));
      await t.mutation(internal.postLifecycle.backfillPublishedPosts, {
        paginationOpts: { numItems: 2, cursor: null },
      });
      const afterRetry = await t.run(async (ctx) =>
        Promise.all(
          [
            ids.legacyFirst,
            ids.publishedWithoutTimestamp,
            ids.draft,
            ids.normalized,
            ids.legacySecond,
          ].map((id) => ctx.db.get(id)),
        ),
      );
      expect(
        afterRetry.map((post) => ({
          status: post?.status,
          publishedAt: post?.publishedAt,
          updatedAt: post?.updatedAt,
          body: post?.body,
        })),
      ).toEqual(beforeRetry);
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts the lifecycle backfill from the operator entry point", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const postId = await t.run(async (ctx) =>
        ctx.db.insert("posts", {
          title: "Legacy post",
          body: "legacy body",
          authorId: "author-1",
          commentCount: 0,
          createdAt: 100,
          updatedAt: 101,
        }),
      );

      expect(
        await t.mutation(internal.crons.runPostLifecycleBackfill, {}),
      ).toBeNull();
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      await t.run(async (ctx) => {
        const post = await ctx.db.get(postId);
        expect(post).toMatchObject({ status: "published", publishedAt: 100 });
      });
    } finally {
      vi.useRealTimers();
    }
  });

  const storageId = "storage-image-1" as Id<"_storage">;
  const secondStorageId = "storage-image-2" as Id<"_storage">;
  const sessionId = "session-1" as Id<"pendingUploads">;

  const claim = (
    overrides: Partial<{
      _id: Id<"pendingUploads">;
      userId: string;
      storageId: Id<"_storage">;
      expiresAt: number;
      consumedAt: number;
    }> = {},
  ) => ({
    _id: sessionId,
    userId: "author-1",
    storageId,
    createdAt: 1,
    expiresAt: 100,
    ...overrides,
  });

  it("accepts unique owned unexpired inline upload claims", () => {
    expect(
      validateInlineUploadClaims(
        [storageId, secondStorageId],
        [
          claim(),
          claim({
            _id: "session-2" as Id<"pendingUploads">,
            storageId: secondStorageId,
          }),
        ],
        "author-1",
        50,
      ),
    ).toEqual([sessionId, "session-2"]);
  });

  it("allows duplicate image references to use one claim", () => {
    const imageStorageIds = extractImageStorageIds([
      {
        type: "image",
        props: { storageId, altText: "First image" },
      },
      {
        type: "image",
        props: { storageId, altText: "Repeated image" },
      },
    ]);

    expect(imageStorageIds).toEqual([storageId]);
    expect(
      validateInlineUploadClaims(
        imageStorageIds as Id<"_storage">[],
        [claim()],
        "author-1",
        50,
      ),
    ).toEqual([sessionId]);
  });

  it.each([
    ["missing", null],
    ["foreign", claim({ userId: "author-2" })],
    ["malformed", claim({ storageId: secondStorageId })],
  ])("rejects %s inline upload claims before insertion", (_reason, value) => {
    expect(() =>
      validateInlineUploadClaims([storageId], [value], "author-1", 50),
    ).toThrow("Invalid inline upload claim");
  });

  it("reports an expired matching claim distinctly", () => {
    expect(() =>
      validateInlineUploadClaims(
        [storageId],
        [claim({ expiresAt: 50 })],
        "author-1",
        50,
      ),
    ).toThrow("Inline image expired");
  });

  it("rejects a claim that was already consumed by a published post", () => {
    expect(() =>
      validateInlineUploadClaims(
        [storageId],
        [claim({ consumedAt: 75 })],
        "author-1",
        50,
      ),
    ).toThrow("Invalid inline upload claim");
  });

  it("accepts valid structured publish bodies", () => {
    const structuredBody = JSON.stringify({
      format: BLOCKNOTE_FORMAT,
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Valid post content." }],
        },
      ],
    });

    expect(isValidPublishPostBody(structuredBody)).toBe(true);
  });

  it("rejects legacy and non-blocknote bodies for new posts", () => {
    expect(isValidPublishPostBody("Legacy post content.")).toBe(false);
    expect(isValidPublishPostBody("")).toBe(false);
    expect(isValidPublishPostBody("null")).toBe(false);
    expect(
      isValidPublishPostBody(JSON.stringify({ format: "other@1", blocks: [] })),
    ).toBe(false);
  });

  it("accepts structured bodies at the exact readable-text boundaries", () => {
    const bodyWithText = (text: string) =>
      JSON.stringify({
        format: BLOCKNOTE_FORMAT,
        blocks: [
          {
            type: "paragraph",
            content: [{ type: "text", text }],
          },
        ],
      });

    expect(
      isValidPublishPostBody(bodyWithText("x".repeat(MIN_POST_TEXT_LENGTH))),
    ).toBe(true);
    expect(
      isValidPublishPostBody(
        bodyWithText("x".repeat(MIN_POST_TEXT_LENGTH - 1)),
      ),
    ).toBe(false);
    expect(
      isValidPublishPostBody(bodyWithText("x".repeat(MAX_POST_TEXT_LENGTH))),
    ).toBe(true);
  });

  it("rejects malformed structured create-post bodies", () => {
    expect(
      isValidPublishPostBody(
        JSON.stringify({
          format: BLOCKNOTE_FORMAT,
          blocks: [{ type: "image", props: {} }],
        }),
      ),
    ).toBe(false);
    expect(
      isValidPublishPostBody(
        JSON.stringify({ format: BLOCKNOTE_FORMAT, blocks: [] }),
      ),
    ).toBe(false);
  });

  it("rejects structured create-post bodies over the text limit", () => {
    expect(
      isValidPublishPostBody(
        JSON.stringify({
          format: BLOCKNOTE_FORMAT,
          blocks: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "x".repeat(MAX_POST_TEXT_LENGTH + 1),
                },
              ],
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("keeps draft validation permissive and publish validation strict", () => {
    const emptyBody = JSON.stringify({
      format: BLOCKNOTE_FORMAT,
      blocks: [],
    });
    const shortBody = JSON.stringify({
      format: BLOCKNOTE_FORMAT,
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "short" }],
        },
      ],
    });

    expect(isValidDraftPostBody(emptyBody)).toBe(true);
    expect(isValidDraftPostBody(shortBody)).toBe(true);
    expect(isValidPublishPostBody(emptyBody)).toBe(false);
    expect(isValidPublishPostBody(shortBody)).toBe(false);
  });

  it("rejects draft and publish mutations when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const draftId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Draft",
        body: JSON.stringify({ format: BLOCKNOTE_FORMAT, blocks: [] }),
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    await expect(
      t.mutation(api.posts.saveDraft, {
        title: "",
        body: JSON.stringify({ format: BLOCKNOTE_FORMAT, blocks: [] }),
        tags: [],
      }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      t.mutation(api.posts.publishPost, { draftId }),
    ).rejects.toThrow("Unauthorized");
  });

  it("fails softly for unauthenticated draft reads", async () => {
    const t = convexTest(schema, modules);

    expect(
      await t.query(api.posts.getDrafts, {
        paginationOpts: { numItems: 12, cursor: null },
      }),
    ).toMatchObject({ page: [], isDone: true });

    const draftId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Private draft",
        body: JSON.stringify({ format: BLOCKNOTE_FORMAT, blocks: [] }),
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    expect(await t.query(api.posts.getDraftById, { draftId })).toBeNull();
    await expect(t.mutation(api.posts.deleteDraft, { draftId })).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("rejects upload URL generation when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.posts.generateImageUploadUrl, {}),
    ).rejects.toThrow("Unauthorized");
  });

  it("returns posts in descending creation order", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const firstImage = await ctx.storage.store(
        new Blob([new Uint8Array([1])], { type: "image/png" }),
      );

      await ctx.db.insert("posts", {
        title: "Older",
        body: "Older body content.",
        authorId: "user-1",
        imageStorageId: firstImage,
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const secondImage = await ctx.storage.store(
        new Blob([new Uint8Array([2])], { type: "image/png" }),
      );

      await ctx.db.insert("posts", {
        title: "Newer",
        body: "Newer body content.",
        authorId: "user-1",
        imageStorageId: secondImage,
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page.map((post) => post.title)).toEqual(["Newer", "Older"]);
  });

  it("validates canonical post tags independently on the server", () => {
    expect(isValidPostTags([])).toBe(true);
    expect(isValidPostTags(["Technology"])).toBe(true);
    expect(
      isValidPostTags(["Technology", "Design", "Music", "Theory", "Landscape"]),
    ).toBe(true);
    expect(isValidPostTags(["Unknown"])).toBe(false);
    expect(isValidPostTags(["Technology", "Technology"])).toBe(false);
    expect(
      isValidPostTags([
        "Technology",
        "Design",
        "Music",
        "Theory",
        "Landscape",
        "Science",
      ]),
    ).toBe(false);
  });

  it("filters exact tag membership while preserving source pagination cursors", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "Newest untagged",
        body: "Body.",
        authorId: "user-1",
        tags: [],
        commentCount: 0,
        likeCount: 0,
        createdAt: 300,
        updatedAt: 300,
      });
      await ctx.db.insert("posts", {
        title: "Tagged technology",
        body: "Body.",
        authorId: "user-1",
        tags: ["Technology", "Design"],
        commentCount: 0,
        likeCount: 0,
        createdAt: 200,
        updatedAt: 200,
      });
      await ctx.db.insert("posts", {
        title: "Old untagged",
        body: "Body.",
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: 100,
        updatedAt: 100,
      });
    });

    const firstPage = await t.query(api.posts.getPosts, {
      tag: "Technology",
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(firstPage.page).toEqual([]);
    expect(firstPage.isDone).toBe(false);

    const secondPage = await t.query(api.posts.getPosts, {
      tag: "Technology",
      paginationOpts: { numItems: 1, cursor: firstPage.continueCursor },
    });
    expect(secondPage.page.map((post) => post.title)).toEqual([
      "Tagged technology",
    ]);
  });

  it("returns an empty completed page for an unknown tag", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "Visible post",
        body: "Body.",
        authorId: "user-1",
        tags: ["RemovedTag"],
        commentCount: 0,
        likeCount: 0,
        createdAt: 100,
        updatedAt: 100,
      });
    });

    const unfiltered = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(unfiltered.page[0].tags).toEqual(["RemovedTag"]);

    const result = await t.query(api.posts.getPosts, {
      tag: "RemovedTag",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });

  it("normalizes missing post tags on detail reads", async () => {
    const t = convexTest(schema, modules);
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Legacy post",
        body: "Body.",
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: 100,
        updatedAt: 100,
      }),
    );

    const result = await t.query(api.posts.getPostById, { postId });
    expect(result?.tags).toEqual([]);
  });

  it("returns null when post does not exist", async () => {
    const t = convexTest(schema, modules);

    const deletedId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "To be deleted",
        body: "Body content.",
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    const result = await t.query(api.posts.getPostById, {
      postId: deletedId,
    });

    expect(result).toBeNull();
  });

  it("returns post with resolved imageUrl when post has an image", async () => {
    const t = convexTest(schema, modules);

    const insertedId = await t.run(async (ctx) => {
      const imageStorageId = await ctx.storage.store(
        new Blob([new Uint8Array([1])], { type: "image/png" }),
      );

      return await ctx.db.insert("posts", {
        title: "Post with image",
        body: "Body content.",
        authorId: "user-1",
        imageStorageId,
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostById, {
      postId: insertedId,
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Post with image");
    expect(result?.imageUrl).toBeTruthy();
    expect(typeof result?.imageUrl).toBe("string");
  });

  it("returns post with null imageUrl when post has no image", async () => {
    const t = convexTest(schema, modules);

    const insertedId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "Post without image",
        body: "Body content.",
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostById, {
      postId: insertedId,
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Post without image");
    expect(result?.imageUrl).toBeNull();
    expect(result?.inlineImages).toEqual([]);
  });

  it("hydrates unique inline image URLs in document order", async () => {
    const t = convexTest(schema, modules);
    const { postId, first, second } = await t.run(async (ctx) => {
      const first = await ctx.storage.store(
        new Blob([new Uint8Array([1])], { type: "image/png" }),
      );
      const second = await ctx.storage.store(
        new Blob([new Uint8Array([2])], { type: "image/png" }),
      );

      return {
        postId: await ctx.db.insert("posts", {
          title: "Inline images",
          body: JSON.stringify({
            format: "blocknote@1",
            blocks: [
              {
                type: "image",
                props: { storageId: first, altText: "First" },
              },
              {
                type: "bulletListItem",
                content: [{ type: "text", text: "Nested image" }],
                children: [
                  {
                    type: "image",
                    props: { storageId: second, altText: "Second" },
                  },
                ],
              },
              {
                type: "image",
                props: { storageId: first, altText: "Repeated" },
              },
            ],
          }),
          authorId: "user-1",
          commentCount: 0,
          likeCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
        first,
        second,
      };
    });

    const result = await t.query(api.posts.getPostById, { postId });

    expect(result?.inlineImages).toHaveLength(2);
    expect(result?.inlineImages[0].storageId).toBe(first);
    expect(result?.inlineImages[0].url).toBeTruthy();
    expect(result?.inlineImages[1].storageId).toBe(second);
    expect(result?.inlineImages[1].url).toBeTruthy();
  });

  it("retains unresolved inline image entries as null URLs", async () => {
    const t = convexTest(schema, modules);
    const { postId, storageId } = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob([new Uint8Array([1])], { type: "image/png" }),
      );
      const postId = await ctx.db.insert("posts", {
        title: "Missing inline image",
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "image",
              props: { storageId, altText: "Missing" },
            },
          ],
        }),
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.storage.delete(storageId);
      return { postId, storageId };
    });

    const result = await t.query(api.posts.getPostById, { postId });

    expect(result?.inlineImages).toEqual([{ storageId, url: null }]);
  });

  it("returns the stored structured body verbatim from getPostById", async () => {
    const t = convexTest(schema, modules);
    const body = JSON.stringify({
      format: BLOCKNOTE_FORMAT,
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Stored structured body" }],
        },
      ],
    });
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Structured post",
        body,
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: 100,
        updatedAt: 100,
      }),
    );

    const result = await t.query(api.posts.getPostById, { postId });

    expect(result?.body).toBe(body);
  });

  it("keeps stored legacy bodies readable with no inline images", async () => {
    const t = convexTest(schema, modules);
    const body = "Legacy stored body";
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Legacy post",
        body,
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: 100,
        updatedAt: 100,
      }),
    );

    const result = await t.query(api.posts.getPostById, { postId });

    expect(result?.body).toBe(body);
    expect(result?.inlineImages).toEqual([]);
  });

  it("serves malformed stored structured bodies without inline images", async () => {
    const t = convexTest(schema, modules);
    const body = JSON.stringify({
      format: BLOCKNOTE_FORMAT,
      blocks: [{ type: "image", props: {} }],
    });
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Malformed structured post",
        body,
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: 100,
        updatedAt: 100,
      }),
    );

    const result = await t.query(api.posts.getPostById, { postId });

    expect(result?.inlineImages).toEqual([]);
  });

  it("returns commentCount in getPosts", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Post with comments",
        body: "Body.",
        authorId: "user-1",
        commentCount: 2,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return id;
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    const found = result.page.find((p) => p._id === postId);
    expect(found).toBeDefined();
    expect(found?.commentCount).toBe(2);
  });

  it("hydrates author name and avatar in getPosts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "user-1",
        displayName: "Bob",
        avatarUrl: "https://example.com/bob.png",
        createdAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Bob's post",
        body: "Body.",
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page[0].authorName).toBe("Bob");
    expect(result.page[0].authorAvatarUrl).toBe("https://example.com/bob.png");
  });

  it("returns null authorAvatarUrl in getPosts when user has no users record", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "Ghost post",
        body: "Body.",
        authorId: "unknown-user",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page[0].authorAvatarUrl).toBeNull();
  });

  it("returns total post count via countPosts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "First",
        body: "Body one.",
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Second",
        body: "Body two.",
        authorId: "user-2",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Third",
        body: "Body three.",
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stats", { totalPosts: 3 });
    });

    const count = await t.query(api.posts.countPosts, {});
    expect(count).toBe(3);
  });

  it("returns zero from countPosts when no posts exist", async () => {
    const t = convexTest(schema, modules);

    const count = await t.query(api.posts.countPosts, {});
    expect(count).toBe(0);
  });

  it("returns only the specified author's posts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "First",
        body: "Body one.",
        authorId: "alice",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Second",
        body: "Body two.",
        authorId: "bob",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Third",
        body: "Body three.",
        authorId: "alice",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stats", { totalPosts: 3 });
    });

    const posts = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "alice",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(posts.page.length).toBe(2);
    expect(posts.page[0].title).toBe("Third");
    expect(posts.page[1].title).toBe("First");
  });

  it("pagination works", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("posts", {
          title: `Post ${i}`,
          body: "Body.",
          authorId: "alice",
          commentCount: 0,
          likeCount: 0,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        });
      }
    });

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "alice",
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(result.page).toHaveLength(2);
    expect(result.isDone).toBe(false);
    expect(result.continueCursor).toBeDefined();
  });

  it("hydrates author name and avatar from users table", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "alice",
        displayName: "Alice",
        avatarUrl: "https://example.com/alice.png",
        createdAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Alice's post",
        body: "Body.",
        authorId: "alice",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "alice",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].authorName).toBe("Alice");
    expect(result.page[0].authorAvatarUrl).toBe(
      "https://example.com/alice.png",
    );
  });

  it("returns null authorAvatarUrl when user has no users record", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "Ghost post",
        body: "Body.",
        authorId: "unknown-user",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "unknown-user",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].authorAvatarUrl).toBeNull();
  });

  it("returns empty page for author with no posts", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "nobody",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });

  it("getPostById returns likeCount when set", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "Post with likeCount",
        body: "Body.",
        authorId: "user-1",
        commentCount: 0,
        likeCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostById, {
      postId,
    });

    expect(result).not.toBeNull();
    expect(result?.likeCount).toBe(0);
  });
});
