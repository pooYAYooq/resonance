/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { POST_TAGS } from "../lib/constants/post-tags";
import { BLOCKNOTE_FORMAT } from "../lib/post-content";
import {
  applyTopicStatDelta,
  buildSearchableText,
  diffPostTags,
  ensureTopicStat,
  getDiscoverPostBySourceId,
  getDiscoverSourceData,
  getTopicRow,
  getTopicStat,
  syncPublishedPostProjection,
  upsertDiscoverPost,
  upsertTopicRow,
} from "./discoverProjection";
import { DISCOVER_BATCH_SIZE } from "./discoverBackfill";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.useRealTimers();
});

function structuredBody(text: string): string {
  return JSON.stringify({
    format: BLOCKNOTE_FORMAT,
    blocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  });
}

async function insertPost(
  t: ReturnType<typeof convexTest>,
  tags: string[] = [],
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("posts", {
      title: "Projection title",
      body: structuredBody("Plain body text"),
      tags,
      authorId: "author-1",
      status: "published",
      publishedAt: 123,
      commentCount: 4,
      likeCount: 7,
      uniqueViewCount: 0,
      createdAt: 100,
      updatedAt: 123,
    }),
  );
}

type UpdateDiscoverPostEngagement = (
  ctx: Parameters<typeof getDiscoverPostBySourceId>[0],
  postId: Id<"posts">,
  counts: { likeCount?: number; commentCount?: number },
) => Promise<void>;

async function getUpdateDiscoverPostEngagement(): Promise<
  UpdateDiscoverPostEngagement | undefined
> {
  const projection = (await import("./discoverProjection")) as Record<
    string,
    unknown
  >;
  const helper = projection["updateDiscoverPostEngagement"];
  return typeof helper === "function"
    ? (helper as UpdateDiscoverPostEngagement)
    : undefined;
}

describe("Discover projection helpers", () => {
  it("builds the published source row shape and searchable text", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology", "Design"]);

    const sourceData = await t.run(async (ctx) => {
      const post = await ctx.db.get("posts", postId);
      expect(post).not.toBeNull();
      return getDiscoverSourceData(post!, "Ada Lovelace");
    });

    expect(sourceData).toEqual({
      postId,
      title: "Projection title",
      bodyText: "Plain body text",
      searchableText: expect.stringContaining("Projection title"),
      authorId: "author-1",
      authorName: "Ada Lovelace",
      tags: ["Technology", "Design"],
      publishedAt: 123,
      commentCount: 4,
      likeCount: 7,
    });
    expect(sourceData?.searchableText).toContain("Plain body text");
    expect(sourceData?.searchableText).toContain("Ada Lovelace");
    expect(buildSearchableText("Title", "Body", "Author")).toContain("Body");
  });

  it("does not project drafts or posts without a numeric publication time", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => ({
      draft: await ctx.db.insert("posts", {
        title: "Draft",
        body: structuredBody("Draft body"),
        tags: [],
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
      published: await ctx.db.insert("posts", {
        title: "Missing publication time",
        body: structuredBody("Published body"),
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    }));

    await t.run(async (ctx) => {
      const draft = await ctx.db.get("posts", ids.draft);
      const published = await ctx.db.get("posts", ids.published);
      expect(getDiscoverSourceData(draft!, "Author")).toBeNull();
      expect(getDiscoverSourceData(published!, "Author")).toBeNull();
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "does not project a non-finite publication timestamp: %s",
    async (publishedAt) => {
      const t = convexTest(schema, modules);
      const postId = await insertPost(t);

      await t.run(async (ctx) => {
        const post = await ctx.db.get("posts", postId);
        expect(post).not.toBeNull();
        expect(
          getDiscoverSourceData({ ...post!, publishedAt }, "Author"),
        ).toBeNull();
      });
    },
  );

  it("diffs tags stably into removed, added, and unchanged values", () => {
    expect(
      diffPostTags(
        ["Technology", "Design", "Culture"],
        ["Design", "Science", "Culture"],
      ),
    ).toEqual({
      added: ["Science"],
      removed: ["Technology"],
      unchanged: ["Design", "Culture"],
    });
  });

  it("creates one zero-count indexed stats row for every canonical tag", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (const tag of POST_TAGS) {
        await ensureTopicStat(ctx, tag);
      }
    });

    const stats = await t.run(async (ctx) => {
      const rows = [];
      for (const tag of POST_TAGS) {
        rows.push(await getTopicStat(ctx, tag));
      }
      return rows;
    });

    expect(stats).toHaveLength(POST_TAGS.length);
    expect(stats.every((stat) => stat?.publishedCount === 0)).toBe(true);
  });

  it("keeps repeated ensure calls to one zero-count stats row", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ensureTopicStat(ctx, "Technology");
      await ensureTopicStat(ctx, "Technology");
      await ensureTopicStat(ctx, "Technology");
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("topicStats")
        .withIndex("by_tag", (q) => q.eq("tag", "Technology"))
        .take(10),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].publishedCount).toBe(0);
  });

  it("lets Convex report duplicate topic stats without deleting either row", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("topicStats", {
        tag: "Technology",
        publishedCount: 1,
      });
      await ctx.db.insert("topicStats", {
        tag: "Technology",
        publishedCount: 2,
      });
    });

    await expect(
      t.run(async (ctx) => ensureTopicStat(ctx, "Technology")),
    ).rejects.toThrow(/unique/i);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("topicStats")
        .withIndex("by_tag", (q) => q.eq("tag", "Technology"))
        .take(3),
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.publishedCount).sort()).toEqual([1, 2]);
  });

  it("lets Convex report topic stat duplicates beyond the cleanup bound", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i++) {
        await ctx.db.insert("topicStats", {
          tag: "Technology",
          publishedCount: 0,
        });
      }
    });

    await expect(
      t.run(async (ctx) => ensureTopicStat(ctx, "Technology")),
    ).rejects.toThrow(/unique/i);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("topicStats")
        .withIndex("by_tag", (q) => q.eq("tag", "Technology"))
        .take(102),
    );
    expect(rows).toHaveLength(101);
  });
});

describe("Discover projection persistence helpers", () => {
  it("updates only supplied engagement counts on an existing projection", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t);
    const updateDiscoverPostEngagement =
      await getUpdateDiscoverPostEngagement();
    expect(updateDiscoverPostEngagement).toBeTypeOf("function");
    if (!updateDiscoverPostEngagement) return;

    await t.run(async (ctx) => {
      const post = await ctx.db.get("posts", postId);
      expect(post).not.toBeNull();
      await upsertDiscoverPost(
        ctx,
        getDiscoverSourceData(post!, "Ada Lovelace")!,
      );
      await updateDiscoverPostEngagement(ctx, postId, { likeCount: 8 });
    });

    expect(
      await t.run(async (ctx) => getDiscoverPostBySourceId(ctx, postId)),
    ).toMatchObject({ likeCount: 8, commentCount: 4 });

    await t.run(async (ctx) => {
      await updateDiscoverPostEngagement(ctx, postId, { commentCount: 5 });
    });

    expect(
      await t.run(async (ctx) => getDiscoverPostBySourceId(ctx, postId)),
    ).toMatchObject({ likeCount: 8, commentCount: 5 });
  });

  it("does not create a projection when updating absent engagement data", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t);
    const updateDiscoverPostEngagement =
      await getUpdateDiscoverPostEngagement();
    expect(updateDiscoverPostEngagement).toBeTypeOf("function");
    if (!updateDiscoverPostEngagement) return;

    await t.run(async (ctx) => {
      await updateDiscoverPostEngagement(ctx, postId, { likeCount: 8 });
    });

    await expect(
      t.run(async (ctx) => getDiscoverPostBySourceId(ctx, postId)),
    ).resolves.toBeNull();
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid projection engagement counts: %s", async (count) => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t);
    const updateDiscoverPostEngagement =
      await getUpdateDiscoverPostEngagement();
    expect(updateDiscoverPostEngagement).toBeTypeOf("function");
    if (!updateDiscoverPostEngagement) return;

    await expect(
      t.run(async (ctx) =>
        updateDiscoverPostEngagement(ctx, postId, { likeCount: count }),
      ),
    ).rejects.toThrow(ConvexError);
    await expect(
      t.run(async (ctx) =>
        updateDiscoverPostEngagement(ctx, postId, { commentCount: count }),
      ),
    ).rejects.toThrow(ConvexError);
  });

  it("syncs a published post into all projections and ignores stale tags", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology", "Design", "Stale tag"]);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-1",
        displayName: "Ada Lovelace",
        bio: "",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      await syncPublishedPostProjection(ctx, postId);
    });

    const result = await t.run(async (ctx) => ({
      discover: await getDiscoverPostBySourceId(ctx, postId),
      topics: await ctx.db
        .query("discoverPostTopics")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .collect(),
      stats: await Promise.all(
        ["Technology", "Design", "Stale tag"].map((tag) =>
          getTopicStat(ctx, tag),
        ),
      ),
    }));

    expect(result.discover).toMatchObject({
      postId,
      authorName: "Ada Lovelace",
      publishedAt: 123,
      tags: ["Technology", "Design"],
    });
    expect(result.discover?.searchableText).toContain("Ada Lovelace");
    expect(result.topics.map((topic) => topic.tag).sort()).toEqual([
      "Design",
      "Technology",
    ]);
    expect(result.stats.map((stat) => stat?.publishedCount)).toEqual([
      1,
      1,
      undefined,
    ]);
  });

  it("keeps a repeated sync idempotent without duplicate rows or counter inflation", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology", "Technology"]);

    await t.run(async (ctx) => {
      await syncPublishedPostProjection(ctx, postId);
      await syncPublishedPostProjection(ctx, postId);
    });

    const result = await t.run(async (ctx) => ({
      discover: await getDiscoverPostBySourceId(ctx, postId),
      topics: await ctx.db
        .query("discoverPostTopics")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .collect(),
      stat: await getTopicStat(ctx, "Technology"),
    }));

    expect(result.discover).not.toBeNull();
    expect(result.topics).toHaveLength(1);
    expect(result.stat?.publishedCount).toBe(1);
  });

  it("fails atomically when a retained topic row is missing its stats row", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology"]);

    await t.run(async (ctx) => {
      await ctx.db.insert("discoverPostTopics", {
        tag: "Technology",
        postId,
        publishedAt: 123,
      });
    });

    await expect(
      t.run(async (ctx) => syncPublishedPostProjection(ctx, postId)),
    ).rejects.toThrow(ConvexError);

    const result = await t.run(async (ctx) => ({
      discover: await getDiscoverPostBySourceId(ctx, postId),
      topics: await ctx.db
        .query("discoverPostTopics")
        .withIndex("by_postId_and_tag", (q) =>
          q.eq("postId", postId).eq("tag", "Technology"),
        )
        .take(2),
      stat: await getTopicStat(ctx, "Technology"),
    }));

    expect(result.discover).toBeNull();
    expect(result.topics).toHaveLength(1);
    expect(result.stat).toBeNull();
  });

  it("updates edited projection fields and applies the exact tag diff", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology", "Design"]);

    await t.run(async (ctx) => {
      await syncPublishedPostProjection(ctx, postId);
      await ctx.db.patch(postId, {
        title: "Edited title",
        body: structuredBody("Edited body"),
        tags: ["Design", "Science"],
        publishedAt: 123,
        updatedAt: 124,
      });
      await syncPublishedPostProjection(ctx, postId, ["Technology", "Design"]);
    });

    const result = await t.run(async (ctx) => ({
      discover: await getDiscoverPostBySourceId(ctx, postId),
      topics: await ctx.db
        .query("discoverPostTopics")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .collect(),
      technology: await getTopicStat(ctx, "Technology"),
      design: await getTopicStat(ctx, "Design"),
      science: await getTopicStat(ctx, "Science"),
    }));

    expect(result.discover).toMatchObject({
      title: "Edited title",
      bodyText: "Edited body",
      publishedAt: 123,
      tags: ["Design", "Science"],
    });
    expect(result.topics.map((topic) => topic.tag).sort()).toEqual([
      "Design",
      "Science",
    ]);
    expect(result.technology?.publishedCount).toBe(0);
    expect(result.design?.publishedCount).toBe(1);
    expect(result.science?.publishedCount).toBe(1);
  });

  it("does not write projections for a draft", async () => {
    const t = convexTest(schema, modules);
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Draft",
        body: structuredBody("Draft body"),
        tags: ["Technology"],
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    await t.run(async (ctx) => syncPublishedPostProjection(ctx, postId));

    const rows = await t.run(async (ctx) => ({
      discover: await getDiscoverPostBySourceId(ctx, postId),
      topics: await ctx.db
        .query("discoverPostTopics")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .collect(),
    }));
    expect(rows).toEqual({ discover: null, topics: [] });
  });

  it("backfills published posts in bounded pages and remains idempotent", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const firstPostId = await insertPost(t, ["Technology"]);
    const secondPostId = await insertPost(t, ["Design"]);
    const draftPostId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "Backfill draft",
        body: structuredBody("Draft body"),
        tags: ["Culture"],
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
    });

    const first = await t.mutation(internal.discoverBackfill.backfillDiscover, {
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(first).toEqual({ processed: 1, isDone: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const second = await t.mutation(
      internal.discoverBackfill.backfillDiscover,
      {
        paginationOpts: { numItems: 1, cursor: null },
      },
    );
    expect(second).toEqual({ processed: 1, isDone: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const result = await t.run(async (ctx) => ({
      first: await getDiscoverPostBySourceId(ctx, firstPostId),
      second: await getDiscoverPostBySourceId(ctx, secondPostId),
      draft: await getDiscoverPostBySourceId(ctx, draftPostId),
      topics: await ctx.db.query("discoverPostTopics").take(10),
      stats: await ctx.db.query("topicStats").take(100),
    }));
    expect(result.first).not.toBeNull();
    expect(result.second).not.toBeNull();
    expect(result.draft).toBeNull();
    expect(result.topics).toHaveLength(2);
    expect(result.stats).toHaveLength(POST_TAGS.length);
    expect(
      result.stats
        .filter((stat) => stat.tag === "Technology" || stat.tag === "Design")
        .map((stat) => stat.publishedCount)
        .sort(),
    ).toEqual([1, 1]);
    expect(
      result.stats.filter((stat) => stat.publishedCount === 0),
    ).toHaveLength(POST_TAGS.length - 2);
  });

  it("repairs author names and searchable text across bounded continuations", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const postIds = await Promise.all([
      insertPost(t, ["Technology"]),
      insertPost(t, ["Design"]),
      insertPost(t, ["Culture"]),
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-1",
        displayName: "Old Name",
        bio: "",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      for (const postId of postIds) {
        await syncPublishedPostProjection(ctx, postId);
      }
      const user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", "author-1"))
        .unique();
      expect(user).not.toBeNull();
      await ctx.db.patch(user!._id, { displayName: "New Name" });
    });

    const first = await t.mutation(internal.discoverBackfill.repairAuthorName, {
      authorId: "author-1",
      newAuthorName: "New Name",
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(first).toEqual({ processed: 1, isDone: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("discoverPosts")
        .withIndex("by_authorId", (q) => q.eq("authorId", "author-1"))
        .collect(),
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.authorName === "New Name")).toBe(true);
    expect(rows.every((row) => row.searchableText.includes("New Name"))).toBe(
      true,
    );
    expect(rows.every((row) => !row.searchableText.includes("Old Name"))).toBe(
      true,
    );
  });

  it("does not let an older repair continuation overwrite a newer profile name", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const postIds = await Promise.all([
      insertPost(t, ["Technology"]),
      insertPost(t, ["Design"]),
      insertPost(t, ["Culture"]),
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-1",
        displayName: "Old Name",
        bio: "",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      for (const postId of postIds) {
        await syncPublishedPostProjection(ctx, postId);
      }
    });

    const oldRepair = await t.mutation(
      internal.discoverBackfill.repairAuthorName,
      {
        authorId: "author-1",
        newAuthorName: "Old Name",
        paginationOpts: { numItems: 1, cursor: null },
      },
    );
    expect(oldRepair).toEqual({ processed: 1, isDone: false });

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", "author-1"))
        .unique();
      expect(user).not.toBeNull();
      await ctx.db.patch(user!._id, { displayName: "Newest Name" });
    });

    const newRepair = await t.mutation(
      internal.discoverBackfill.repairAuthorName,
      {
        authorId: "author-1",
        newAuthorName: "Newest Name",
        paginationOpts: { numItems: DISCOVER_BATCH_SIZE, cursor: null },
      },
    );
    expect(newRepair).toEqual({ processed: 3, isDone: true });

    // The queued continuation still carries the old captured name.
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("discoverPosts")
        .withIndex("by_authorId", (q) => q.eq("authorId", "author-1"))
        .collect(),
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.authorName === "Newest Name")).toBe(true);
    expect(
      rows.every((row) => row.searchableText.includes("Newest Name")),
    ).toBe(true);
  });

  it.each([
    0,
    -1,
    DISCOVER_BATCH_SIZE + 1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])(
    "rejects invalid Discover maintenance batch size: %s",
    async (numItems) => {
      const t = convexTest(schema, modules);
      const paginationOpts = { numItems, cursor: null };

      await expect(
        t.mutation(internal.discoverBackfill.backfillDiscover, {
          paginationOpts,
        }),
      ).rejects.toThrow(ConvexError);
      await expect(
        t.mutation(internal.discoverBackfill.repairAuthorName, {
          authorId: "author-1",
          newAuthorName: "Name",
          paginationOpts,
        }),
      ).rejects.toThrow(ConvexError);
    },
  );

  it("rejects Discover pagination scans above the server cap", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.discover.getDiscoverPosts, {
        mode: "latest",
        paginationOpts: { numItems: 20, maximumRowsRead: 21, cursor: null },
      }),
    ).rejects.toThrow("rows");
  });

  it("uses exact indexed lookups and keeps post/topic upserts idempotent", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology"]);
    const initial = await t.run(async (ctx) => {
      const post = await ctx.db.get("posts", postId);
      const sourceData = getDiscoverSourceData(post!, "Ada Lovelace");
      expect(sourceData).not.toBeNull();
      const discoverId = await upsertDiscoverPost(ctx, sourceData!);
      const topicId = await upsertTopicRow(ctx, {
        tag: "Technology",
        postId,
        publishedAt: 123,
      });
      return { discoverId, topicId };
    });

    await t.run(async (ctx) => {
      await upsertDiscoverPost(ctx, {
        postId,
        title: "Updated title",
        bodyText: "Updated body",
        searchableText: "Updated title Updated body Ada Lovelace",
        authorId: "author-1",
        authorName: "Ada Lovelace",
        tags: ["Technology"],
        publishedAt: 123,
        commentCount: 5,
        likeCount: 8,
      });
      await upsertTopicRow(ctx, {
        tag: "Technology",
        postId,
        publishedAt: 123,
      });
    });

    const rows = await t.run(async (ctx) => ({
      discover: await getDiscoverPostBySourceId(ctx, postId),
      topic: await getTopicRow(ctx, postId, "Technology"),
    }));
    expect(rows.discover?._id).toBe(initial.discoverId);
    expect(rows.discover?.title).toBe("Updated title");
    expect(rows.topic?._id).toBe(initial.topicId);
  });

  it("clears a previously projected cover image when the source omits it", async () => {
    const t = convexTest(schema, modules);
    const { imageStorageId, postId } = await t.run(async (ctx) => {
      const imageStorageId = await ctx.storage.store(new Blob(["cover"]));
      const postId = await ctx.db.insert("posts", {
        title: "Cover post",
        body: structuredBody("Cover body"),
        tags: [],
        authorId: "author-1",
        imageStorageId,
        status: "published",
        publishedAt: 123,
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 100,
        updatedAt: 123,
      });
      return { imageStorageId, postId };
    });

    await t.run(async (ctx) => {
      const post = await ctx.db.get("posts", postId);
      expect(post).not.toBeNull();
      const sourceWithImage = getDiscoverSourceData(post!, "Author");
      expect(sourceWithImage?.imageStorageId).toBe(imageStorageId);
      await upsertDiscoverPost(ctx, sourceWithImage!);

      const sourceWithoutImage = getDiscoverSourceData(
        { ...post!, imageStorageId: undefined },
        "Author",
      );
      expect(sourceWithoutImage).not.toHaveProperty("imageStorageId");
      await upsertDiscoverPost(ctx, sourceWithoutImage!);
    });

    const stored = await t.run(async (ctx) =>
      getDiscoverPostBySourceId(ctx, postId),
    );
    expect(stored).not.toBeNull();
    expect(stored).not.toHaveProperty("imageStorageId");
  });

  it("keeps one topic row for each unique canonical tag", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology", "Design"]);
    const tags = ["Technology", "Design", "Technology"];

    await t.run(async (ctx) => {
      for (const tag of new Set(tags)) {
        await upsertTopicRow(ctx, { tag, postId, publishedAt: 123 });
      }
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("discoverPostTopics")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .take(10),
    );
    expect(rows.map((row) => row.tag).sort()).toEqual(["Design", "Technology"]);
  });

  it("lets Convex report duplicate exact topic rows", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology"]);

    await t.run(async (ctx) => {
      await ctx.db.insert("discoverPostTopics", {
        tag: "Technology",
        postId,
        publishedAt: 123,
      });
      await ctx.db.insert("discoverPostTopics", {
        tag: "Technology",
        postId,
        publishedAt: 123,
      });
    });

    await expect(
      t.run(async (ctx) => getTopicRow(ctx, postId, "Technology")),
    ).rejects.toThrow(/unique/i);
  });

  it("rejects duplicate topic tags before writing the discover post", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology", "Design"]);

    await t.run(async (ctx) => {
      await ctx.db.insert("discoverPostTopics", {
        tag: "Technology",
        postId,
        publishedAt: 123,
      });
      await ctx.db.insert("discoverPostTopics", {
        tag: "Technology",
        postId,
        publishedAt: 123,
      });
      await ctx.db.insert("discoverPostTopics", {
        tag: "Design",
        postId,
        publishedAt: 123,
      });
    });

    await expect(
      t.run(async (ctx) => syncPublishedPostProjection(ctx, postId)),
    ).rejects.toThrow(ConvexError);

    const result = await t.run(async (ctx) => ({
      discover: await getDiscoverPostBySourceId(ctx, postId),
      topics: await ctx.db
        .query("discoverPostTopics")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .take(4),
    }));
    expect(result.discover).toBeNull();
    expect(result.topics).toHaveLength(3);
    expect(result.topics.map((row) => row.tag).sort()).toEqual([
      "Design",
      "Technology",
      "Technology",
    ]);
  });

  it("fails before writes when per-post topic duplicates exceed the cleanup bound", async () => {
    const t = convexTest(schema, modules);
    const postId = await insertPost(t, ["Technology"]);

    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i++) {
        await ctx.db.insert("discoverPostTopics", {
          tag: "Technology",
          postId,
          publishedAt: 123,
        });
      }
    });

    await expect(
      t.run(async (ctx) => syncPublishedPostProjection(ctx, postId)),
    ).rejects.toThrow(ConvexError);

    const result = await t.run(async (ctx) => ({
      discover: await getDiscoverPostBySourceId(ctx, postId),
      topics: await ctx.db
        .query("discoverPostTopics")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .take(102),
    }));
    expect(result.discover).toBeNull();
    expect(result.topics).toHaveLength(101);
  });

  it("creates stats rows and applies deltas without allowing negative counts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ensureTopicStat(ctx, "Technology");
      await applyTopicStatDelta(ctx, "Technology", 2);
    });

    await t.run(async (ctx) => {
      const stat = await getTopicStat(ctx, "Technology");
      expect(stat?.publishedCount).toBe(2);
      await applyTopicStatDelta(ctx, "Technology", -1);
    });

    await expect(
      t.run(async (ctx) => applyTopicStatDelta(ctx, "Technology", -2)),
    ).rejects.toThrow(ConvexError);

    const stat = await t.run(async (ctx) => getTopicStat(ctx, "Technology"));
    expect(stat?.publishedCount).toBe(1);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    1.5,
  ])(
    "rejects an invalid persisted topic counter: %s",
    async (publishedCount) => {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => {
        await ctx.db.insert("topicStats", {
          tag: "Technology",
          publishedCount,
        });
      });

      await expect(
        t.run(async (ctx) => ensureTopicStat(ctx, "Technology")),
      ).rejects.toThrow(ConvexError);
      await expect(
        t.run(async (ctx) => applyTopicStatDelta(ctx, "Technology", 1)),
      ).rejects.toThrow(ConvexError);
    },
  );

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects an invalid topic counter delta: %s", async (delta) => {
    const t = convexTest(schema, modules);
    await expect(
      t.run(async (ctx) => applyTopicStatDelta(ctx, "Technology", delta)),
    ).rejects.toThrow(ConvexError);
  });

  it("rejects a topic counter result that exceeds safe integer bounds", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("topicStats", {
        tag: "Technology",
        publishedCount: Number.MAX_SAFE_INTEGER,
      });
    });

    await expect(
      t.run(async (ctx) => applyTopicStatDelta(ctx, "Technology", 1)),
    ).rejects.toThrow(ConvexError);
  });

  it("returns null for absent exact projection rows", async () => {
    const t = convexTest(schema, modules);
    const postId = "missing-post" as Id<"posts">;

    const result = await t.run(async (ctx) => ({
      discover: await getDiscoverPostBySourceId(ctx, postId),
      topic: await getTopicRow(ctx, postId, "Technology"),
      stat: await getTopicStat(ctx, "Technology"),
    }));

    expect(result).toEqual({ discover: null, topic: null, stat: null });
  });
});

describe("Public Discover queries", () => {
  it.each([0, -1, 21, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid public Discover page sizes: %s",
    async (numItems) => {
      const t = convexTest(schema, modules);
      const paginationOpts = { numItems, cursor: null };

      await expect(
        t.query(api.discover.getDiscoverPosts, {
          mode: "latest",
          paginationOpts,
        }),
      ).rejects.toThrow(ConvexError);
      await expect(
        t.query(api.discover.getDiscoverPosts, {
          mode: "search",
          query: "design",
          paginationOpts,
        }),
      ).rejects.toThrow(ConvexError);
      await expect(
        t.query(api.discover.getTopicPosts, {
          tag: "Technology",
          paginationOpts,
        }),
      ).rejects.toThrow(ConvexError);
    },
  );

  it("does not include a draft source post in anonymous Latest results", async () => {
    const t = convexTest(schema, modules);
    const publishedPostId = await insertPost(t);
    const draftPostId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Draft source",
        body: structuredBody("Draft body"),
        tags: [],
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 200,
        updatedAt: 200,
      }),
    );

    await t.run(async (ctx) => {
      await syncPublishedPostProjection(ctx, publishedPostId);
      await syncPublishedPostProjection(ctx, draftPostId);
    });

    const result = await t.query(api.discover.getDiscoverPosts, {
      mode: "latest",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.map((post) => post._id)).toEqual([publishedPostId]);
    expect(result.page.map((post) => post.title)).not.toContain("Draft source");
  });

  it("returns anonymous Latest results from projections in publishedAt order", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const oldestSource = await ctx.db.insert("posts", {
        title: "Oldest source",
        body: "Old body",
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: 10,
        commentCount: 0,
        likeCount: 0,
        createdAt: 10,
        updatedAt: 10,
      });
      const newestSource = await ctx.db.insert("posts", {
        title: "Newest source",
        body: "New body",
        tags: [],
        authorId: "author-2",
        status: "published",
        publishedAt: 20,
        commentCount: 0,
        likeCount: 0,
        createdAt: 20,
        updatedAt: 20,
      });
      await ctx.db.insert("discoverPosts", {
        postId: oldestSource,
        title: "Oldest",
        bodyText: "Old body",
        searchableText: "Oldest\nOld body\nAda",
        authorId: "author-1",
        authorName: "Ada Lovelace",
        tags: ["Technology"],
        publishedAt: 10,
        commentCount: 1,
        likeCount: 2,
      });
      await ctx.db.insert("discoverPosts", {
        postId: newestSource,
        title: "Newest",
        bodyText: "New body",
        searchableText: "Newest\nNew body\nGrace",
        authorId: "author-2",
        authorName: "Grace Hopper",
        tags: ["Science"],
        publishedAt: 20,
        commentCount: 3,
        likeCount: 4,
      });
      return { oldest: oldestSource, newest: newestSource };
    });

    const result = await t.query(api.discover.getDiscoverPosts, {
      mode: "latest",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.map((post) => post._id)).toEqual([
      ids.newest,
      ids.oldest,
    ]);
    expect(result.page[0]).toEqual({
      _id: ids.newest,
      title: "Newest",
      bodyText: "New body",
      authorId: "author-2",
      authorName: "Grace Hopper",
      tags: ["Science"],
      imageUrl: null,
      publishedAt: 20,
      commentCount: 3,
      likeCount: 4,
    });
  });

  it("searches projected title, body text, and author name with native ordering", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (const [title, bodyText, authorName] of [
        ["Design systems", "A practical guide", "Ada Lovelace"],
        ["A quiet essay", "Design systems in practice", "Grace Hopper"],
        ["Another essay", "A short note", "Design Systems"],
      ]) {
        const postId = await ctx.db.insert("posts", {
          title,
          body: bodyText,
          tags: [],
          authorId: authorName,
          status: "published",
          publishedAt: 1,
          commentCount: 0,
          likeCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("discoverPosts", {
          postId,
          title,
          bodyText,
          searchableText: `${title}\n${bodyText}\n${authorName}`,
          authorId: authorName,
          authorName,
          tags: [],
          publishedAt: 1,
          commentCount: 0,
          likeCount: 0,
        });
      }
    });

    const result = await t.query(api.discover.getDiscoverPosts, {
      mode: "search",
      query: "design systems",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.map((post) => post.title)).toEqual([
      "Design systems",
      "A quiet essay",
      "Another essay",
    ]);
  });

  it("returns active topics in canonical order and omits zero-count tags", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("topicStats", {
        tag: "Science",
        publishedCount: 2,
      });
      await ctx.db.insert("topicStats", {
        tag: "Technology",
        publishedCount: 1,
      });
      await ctx.db.insert("topicStats", {
        tag: "Design",
        publishedCount: 0,
      });
      await ctx.db.insert("topicStats", {
        tag: "Not canonical",
        publishedCount: 99,
      });
    });

    await expect(t.query(api.discover.getTopics, {})).resolves.toEqual([
      { tag: "Technology", publishedCount: 1 },
      { tag: "Science", publishedCount: 2 },
    ]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5])(
    "omits invalid persisted topic counters: %s",
    async (publishedCount) => {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => {
        await ctx.db.insert("topicStats", {
          tag: "Technology",
          publishedCount,
        });
      });
      await expect(t.query(api.discover.getTopics, {})).resolves.toEqual([]);
    },
  );

  it("hydrates a bounded Topic page, preserves pagination metadata, and skips missing rows", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const sourcePostId = await ctx.db.insert("posts", {
        title: "Existing source",
        body: "Body",
        tags: ["Technology"],
        authorId: "author-1",
        status: "published",
        publishedAt: 20,
        commentCount: 0,
        likeCount: 0,
        createdAt: 20,
        updatedAt: 20,
      });
      const missingProjectionPostId = await ctx.db.insert("posts", {
        title: "Missing projection source",
        body: "Body",
        tags: ["Technology"],
        authorId: "author-2",
        status: "published",
        publishedAt: 30,
        commentCount: 0,
        likeCount: 0,
        createdAt: 30,
        updatedAt: 30,
      });
      await ctx.db.insert("discoverPosts", {
        postId: sourcePostId,
        title: "Existing topic post",
        bodyText: "Body",
        searchableText: "Existing topic post\nBody\nAuthor",
        authorId: "author-1",
        authorName: "Author",
        tags: ["Technology"],
        publishedAt: 20,
        commentCount: 0,
        likeCount: 0,
      });
      await ctx.db.insert("discoverPostTopics", {
        tag: "Technology",
        postId: missingProjectionPostId,
        publishedAt: 30,
      });
      await ctx.db.insert("discoverPostTopics", {
        tag: "Technology",
        postId: sourcePostId,
        publishedAt: 20,
      });
    });

    const result = await t.query(api.discover.getTopicPosts, {
      tag: "Technology",
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(result.page.map((post) => post.title)).toEqual([
      "Existing topic post",
    ]);
    expect(result.isDone).toBe(true);
    expect(result.continueCursor).toBeTruthy();
  });

  it("returns a completed empty page for an invalid Topic tag", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.query(api.discover.getTopicPosts, {
        tag: "Unsupported",
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).resolves.toEqual({ page: [], isDone: true, continueCursor: "" });
  });
});
