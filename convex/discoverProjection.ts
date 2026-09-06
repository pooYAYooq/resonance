import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  isCanonicalPostTag,
  MAX_POST_TAGS,
  POST_TAGS,
} from "../lib/constants/post-tags";
import { extractPlainText, parsePostBody } from "../lib/post-content";

const MAX_CLEANUP_ROWS = 100;

export type DiscoverSourceData = Omit<
  Doc<"discoverPosts">,
  "_id" | "_creationTime"
>;

export type DiscoverTopicData = {
  tag: string;
  postId: Id<"posts">;
  publishedAt: number;
};

export type DiscoverEngagementCounts =
  | { likeCount: number; commentCount?: number }
  | { likeCount?: number; commentCount: number };

// Projection writes and author rename repairs must share this construction.
export function buildSearchableText(
  title: string,
  bodyText: string,
  authorName: string,
): string {
  return [title, bodyText, authorName]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join("\n");
}

export function getDiscoverSourceData(
  post: Doc<"posts">,
  authorName: string,
): DiscoverSourceData | null {
  if (
    post.status !== "published" ||
    typeof post.publishedAt !== "number" ||
    !Number.isFinite(post.publishedAt)
  ) {
    return null;
  }

  const parsedBody = parsePostBody(post.body);
  const bodyText =
    parsedBody.kind === "structured"
      ? extractPlainText(parsedBody.document.blocks)
      : "";

  return {
    postId: post._id,
    title: post.title,
    bodyText,
    searchableText: buildSearchableText(post.title, bodyText, authorName),
    authorId: post.authorId,
    authorName,
    tags: post.tags,
    ...(post.imageStorageId ? { imageStorageId: post.imageStorageId } : {}),
    publishedAt: post.publishedAt,
    commentCount: post.commentCount,
    likeCount: post.likeCount,
  };
}

function uniqueTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    if (seen.has(tag)) return false;
    seen.add(tag);
    return true;
  });
}

function canonicalTags(tags: readonly string[]): string[] {
  return uniqueTags(tags.filter(isCanonicalPostTag)).slice(0, MAX_POST_TAGS);
}

function isValidTopicCounter(value: number): boolean {
  return Number.isFinite(value) && Number.isSafeInteger(value) && value >= 0;
}

function isValidEngagementCount(value: number): boolean {
  return Number.isFinite(value) && Number.isSafeInteger(value) && value >= 0;
}

function assertWithinCleanupBound(
  rows: readonly unknown[],
  message: string,
): void {
  if (rows.length > MAX_CLEANUP_ROWS) {
    throw new ConvexError(message);
  }
}

export function diffPostTags(
  oldTags: readonly string[],
  newTags: readonly string[],
): { added: string[]; removed: string[]; unchanged: string[] } {
  const oldUnique = uniqueTags(oldTags);
  const newUnique = uniqueTags(newTags);
  const oldSet = new Set(oldUnique);
  const newSet = new Set(newUnique);

  return {
    added: newUnique.filter((tag) => !oldSet.has(tag)),
    removed: oldUnique.filter((tag) => !newSet.has(tag)),
    unchanged: oldUnique.filter((tag) => newSet.has(tag)),
  };
}

export async function getDiscoverPostBySourceId(
  ctx: Pick<MutationCtx, "db">,
  postId: Id<"posts">,
): Promise<Doc<"discoverPosts"> | null> {
  return await ctx.db
    .query("discoverPosts")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .unique();
}

export async function getTopicRow(
  ctx: Pick<MutationCtx, "db">,
  postId: Id<"posts">,
  tag: string,
): Promise<Doc<"discoverPostTopics"> | null> {
  return await ctx.db
    .query("discoverPostTopics")
    .withIndex("by_postId_and_tag", (q) =>
      q.eq("postId", postId).eq("tag", tag),
    )
    .unique();
}

export async function getTopicStat(
  ctx: Pick<MutationCtx, "db">,
  tag: string,
): Promise<Doc<"topicStats"> | null> {
  return await ctx.db
    .query("topicStats")
    .withIndex("by_tag", (q) => q.eq("tag", tag))
    .unique();
}

export async function ensureTopicStat(
  ctx: Pick<MutationCtx, "db">,
  tag: string,
): Promise<Id<"topicStats">> {
  const existing = await getTopicStat(ctx, tag);
  if (existing) {
    if (!isValidTopicCounter(existing.publishedCount)) {
      throw new ConvexError("Topic stat counter is invalid.");
    }
    return existing._id;
  }
  return await ctx.db.insert("topicStats", { tag, publishedCount: 0 });
}

export async function ensureCanonicalTopicStats(
  ctx: Pick<MutationCtx, "db">,
): Promise<void> {
  for (const tag of POST_TAGS) {
    await ensureTopicStat(ctx, tag);
  }
}

export async function applyTopicStatDelta(
  ctx: Pick<MutationCtx, "db">,
  tag: string,
  delta: number,
): Promise<Id<"topicStats">> {
  if (!Number.isSafeInteger(delta)) {
    throw new ConvexError("Topic stat delta must be an integer.");
  }

  const existing = await getTopicStat(ctx, tag);
  const currentCount = existing?.publishedCount ?? 0;
  const nextCount = currentCount + delta;
  if (!isValidTopicCounter(currentCount)) {
    throw new ConvexError("Topic stat counter is invalid.");
  }
  if (!isValidTopicCounter(nextCount)) {
    throw new ConvexError("Topic stat counter result is invalid.");
  }

  if (existing) {
    await ctx.db.patch("topicStats", existing._id, {
      publishedCount: nextCount,
    });
    return existing._id;
  }

  return await ctx.db.insert("topicStats", {
    tag,
    publishedCount: nextCount,
  });
}

export async function upsertDiscoverPost(
  ctx: Pick<MutationCtx, "db">,
  sourceData: DiscoverSourceData,
): Promise<Id<"discoverPosts">> {
  const existing = await getDiscoverPostBySourceId(ctx, sourceData.postId);
  if (existing) {
    await ctx.db.replace("discoverPosts", existing._id, sourceData);
    return existing._id;
  }

  return await ctx.db.insert("discoverPosts", sourceData);
}

/** Applies source engagement counts without rebuilding the published projection. */
export async function updateDiscoverPostEngagement(
  ctx: Pick<MutationCtx, "db">,
  postId: Id<"posts">,
  counts: DiscoverEngagementCounts,
): Promise<void> {
  const updates: { likeCount?: number; commentCount?: number } = {};
  if (counts.likeCount !== undefined) {
    if (!isValidEngagementCount(counts.likeCount)) {
      throw new ConvexError("Discover projection like count is invalid.");
    }
    updates.likeCount = counts.likeCount;
  }
  if (counts.commentCount !== undefined) {
    if (!isValidEngagementCount(counts.commentCount)) {
      throw new ConvexError("Discover projection comment count is invalid.");
    }
    updates.commentCount = counts.commentCount;
  }
  if (Object.keys(updates).length === 0) return;

  const projection = await getDiscoverPostBySourceId(ctx, postId);
  if (!projection) return;
  await ctx.db.patch("discoverPosts", projection._id, updates);
}

export async function upsertTopicRow(
  ctx: Pick<MutationCtx, "db">,
  topicData: DiscoverTopicData,
): Promise<Id<"discoverPostTopics">> {
  const existing = await getTopicRow(ctx, topicData.postId, topicData.tag);
  if (existing) {
    await ctx.db.patch("discoverPostTopics", existing._id, topicData);
    return existing._id;
  }

  return await ctx.db.insert("discoverPostTopics", topicData);
}

/** Synchronizes the published-post read models and their canonical counters atomically. */
export async function syncPublishedPostProjection(
  ctx: Pick<MutationCtx, "db">,
  postId: Id<"posts">,
  previousTags?: readonly string[],
): Promise<void> {
  const post = await ctx.db.get("posts", postId);
  if (!post) return;
  if (
    post.status !== "published" ||
    typeof post.publishedAt !== "number" ||
    !Number.isFinite(post.publishedAt)
  ) {
    return;
  }

  const author = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", post.authorId))
    .unique();
  const tags = canonicalTags(post.tags);
  const sourceData = getDiscoverSourceData(
    { ...post, tags },
    author?.displayName ?? "Anonymous",
  );
  if (!sourceData) return;

  const existingRows = await ctx.db
    .query("discoverPostTopics")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(MAX_CLEANUP_ROWS + 1);
  assertWithinCleanupBound(
    existingRows,
    "Too many duplicate topic rows to repair safely.",
  );

  const rowsByTag = new Map<string, Doc<"discoverPostTopics">[]>();
  for (const row of existingRows) {
    const rows = rowsByTag.get(row.tag) ?? [];
    if (rows.length > 0) {
      throw new ConvexError("Duplicate topic rows exist for a post and tag.");
    }
    rows.push(row);
    rowsByTag.set(row.tag, rows);
  }

  // Atomic bounded retries cannot duplicate rows or inflate counters.
  await upsertDiscoverPost(ctx, sourceData);
  const oldTags = canonicalTags(
    previousTags ?? existingRows.map((row) => row.tag),
  );
  const diff = diffPostTags(oldTags, tags);

  const adjustCounter = async (tag: string, delta: number) => {
    await ensureTopicStat(ctx, tag);
    await applyTopicStatDelta(ctx, tag, delta);
  };

  const removeTag = async (tag: string) => {
    const existing = await getTopicRow(ctx, postId, tag);
    if (!existing) return;
    await ctx.db.delete(existing._id);
    rowsByTag.delete(tag);
    await adjustCounter(tag, -1);
  };

  const ensureTag = async (tag: string) => {
    const existing = await getTopicRow(ctx, postId, tag);
    if (existing) {
      const stat = await getTopicStat(ctx, tag);
      if (!stat) {
        throw new ConvexError("Missing topic stat row for retained topic.");
      }
      if (!isValidTopicCounter(stat.publishedCount)) {
        throw new ConvexError("Topic stat counter is invalid.");
      }
      await ctx.db.patch(existing._id, {
        publishedAt: sourceData.publishedAt,
      });
      rowsByTag.set(tag, [existing]);
      return;
    }
    await ensureTopicStat(ctx, tag);
    await ctx.db.insert("discoverPostTopics", {
      tag,
      postId,
      publishedAt: sourceData.publishedAt,
    });
    rowsByTag.set(tag, []);
    await applyTopicStatDelta(ctx, tag, 1);
  };

  for (const tag of diff.removed) {
    await removeTag(tag);
  }
  for (const tag of diff.added) {
    await ensureTag(tag);
  }
  for (const tag of diff.unchanged) {
    await ensureTag(tag);
  }

  for (const tag of [...rowsByTag.keys()]) {
    if (!tags.includes(tag)) {
      if (isCanonicalPostTag(tag)) {
        await removeTag(tag);
      } else {
        for (const row of rowsByTag.get(tag) ?? []) {
          await ctx.db.delete(row._id);
        }
        rowsByTag.delete(tag);
      }
    }
  }
}

/** Removes a published post's bounded Discover projection and topic counters. */
export async function deletePublishedPostProjection(
  ctx: Pick<MutationCtx, "db">,
  postId: Id<"posts">,
): Promise<void> {
  const projection = await getDiscoverPostBySourceId(ctx, postId);
  if (projection) await ctx.db.delete(projection._id);

  const topicRows = await ctx.db
    .query("discoverPostTopics")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(MAX_CLEANUP_ROWS + 1);
  assertWithinCleanupBound(topicRows, "Too many topic rows to delete safely.");
  const statsByTag = new Map<string, Doc<"topicStats">>();
  const rowsByCanonicalTag = new Map<string, number>();
  for (const row of topicRows) {
    if (!isCanonicalPostTag(row.tag)) continue;
    rowsByCanonicalTag.set(row.tag, (rowsByCanonicalTag.get(row.tag) ?? 0) + 1);
    const stat = await getTopicStat(ctx, row.tag);
    if (!stat) {
      throw new ConvexError("Missing topic stat for deleted topic.");
    }
    if (
      !isValidTopicCounter(stat.publishedCount) ||
      stat.publishedCount === 0
    ) {
      throw new ConvexError("Topic stat counter is invalid for deleted topic.");
    }
    statsByTag.set(row.tag, stat);
  }
  for (const [tag, rowCount] of rowsByCanonicalTag) {
    const stat = statsByTag.get(tag);
    if (!stat || stat.publishedCount < rowCount) {
      throw new ConvexError(
        "Topic stat counter is insufficient for deleted topic.",
      );
    }
  }
  for (const row of topicRows) {
    await ctx.db.delete(row._id);
  }
  for (const [tag, rowCount] of rowsByCanonicalTag) {
    const stat = statsByTag.get(tag)!;
    await ctx.db.patch(stat._id, {
      publishedCount: stat.publishedCount - rowCount,
    });
  }
}
