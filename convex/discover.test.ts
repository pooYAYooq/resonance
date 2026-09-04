/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
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
  upsertDiscoverPost,
  upsertTopicRow,
} from "./discoverProjection";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
});

describe("Discover projection persistence helpers", () => {
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
