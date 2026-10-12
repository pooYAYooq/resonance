/**
 * Shared profile model: validators, stored-shape mapping, and the
 * revision-checked identity write helper. This module registers no public
 * functions; `convex/profiles.ts` exposes the API.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { DISCOVER_BATCH_SIZE } from "./discoverProjection";
import {
  MAX_SELECTED_POSTS,
  normalizeProfileIdentity,
  type IdentityInput,
  type JoinDateDisplay,
  type SocialProfiles,
} from "../lib/profile-identity";

export const MAX_PROFILE_PAGE_SIZE = 20;
const SHOWCASE_LATEST_COUNT = 3;

export type AuthorCard = {
  postId: Id<"posts">;
  title: string;
  imageUrl: string | null;
  likeCount: number;
};

export type Showcase = { mode: "selected" | "latest"; posts: AuthorCard[] };

export type RevisionSave =
  | { kind: "saved"; revision: number }
  | { kind: "conflict" };

export const socialProfilesValidator = v.object({
  instagram: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  behance: v.optional(v.string()),
  youtube: v.optional(v.string()),
  x: v.optional(v.string()),
});

export const joinDateDisplayValidator = v.union(
  v.literal("calendar"),
  v.literal("relative"),
);

export const identityInputValidator = v.object({
  displayName: v.string(),
  bio: v.string(),
  countryCode: v.union(v.string(), v.null()),
  socialProfiles: socialProfilesValidator,
  joinDateDisplay: joinDateDisplayValidator,
});

export const revisionSaveValidator = v.union(
  v.object({ kind: v.literal("saved"), revision: v.number() }),
  v.object({ kind: v.literal("conflict") }),
);

export const authorCardValidator = v.object({
  postId: v.id("posts"),
  title: v.string(),
  imageUrl: v.union(v.string(), v.null()),
  likeCount: v.number(),
});

/** The stored identity as the shared `IdentityInput` shape. */
export function storedIdentity(user: Doc<"users">): IdentityInput {
  return {
    displayName: user.displayName,
    bio: user.bio ?? "",
    countryCode: user.countryCode ?? null,
    socialProfiles: (user.socialProfiles ?? {}) as SocialProfiles,
    joinDateDisplay: (user.joinDateDisplay ?? "calendar") as JoinDateDisplay,
  };
}

export async function getOwnProfile(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

function assertExpectedRevision(expectedRevision: number): void {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new ConvexError("Invalid revision");
  }
}

/**
 * Saves identity at the caller's expected revision. A stale revision returns a
 * conflict without writing; an invalid field throws with its own message; a
 * successful save advances `identityRevision` and repairs denormalized author
 * names when the display name changed.
 */
export async function saveIdentity(
  ctx: MutationCtx,
  user: Doc<"users">,
  expectedRevision: number,
  identity: IdentityInput,
): Promise<RevisionSave> {
  assertExpectedRevision(expectedRevision);
  const revision = user.identityRevision ?? 0;
  if (expectedRevision !== revision) return { kind: "conflict" };

  const normalized = normalizeProfileIdentity(identity);
  if (!normalized.ok) {
    // Carry the field so the editor can attach the message to the right
    // control without matching message text.
    throw new ConvexError({
      field: normalized.field,
      message: normalized.message,
    });
  }
  const value = normalized.value;
  const hasSocials = Object.keys(value.socialProfiles).length > 0;

  await ctx.db.patch(user._id, {
    displayName: value.displayName,
    bio: value.bio,
    countryCode: value.countryCode ?? undefined,
    socialProfiles: hasSocials ? value.socialProfiles : undefined,
    joinDateDisplay: value.joinDateDisplay,
    identityRevision: revision + 1,
  });

  if (value.displayName !== user.displayName) {
    const projectedPosts = await ctx.db
      .query("discoverPosts")
      .withIndex("by_authorId", (q) => q.eq("authorId", user.userId))
      .take(1);
    if (projectedPosts.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.discoverProjection.repairAuthorName,
        {
          authorId: user.userId,
          newAuthorName: value.displayName,
          paginationOpts: { numItems: DISCOVER_BATCH_SIZE, cursor: null },
        },
      );
    }
  }

  return { kind: "saved", revision: revision + 1 };
}

/**
 * Rejects a page size or auxiliary read budget outside the bounded native
 * pagination range, matching the other public list APIs. Without this a caller
 * could pair a far `endCursor` with a large `maximumRowsRead` and turn a bounded
 * read into an expensive range read.
 */
export function assertPageSize(paginationOpts: {
  numItems: number;
  maximumRowsRead?: number;
}): void {
  const { numItems, maximumRowsRead } = paginationOpts;
  if (
    !Number.isSafeInteger(numItems) ||
    numItems < 1 ||
    numItems > MAX_PROFILE_PAGE_SIZE ||
    (maximumRowsRead !== undefined &&
      (!Number.isSafeInteger(maximumRowsRead) ||
        maximumRowsRead < 1 ||
        maximumRowsRead > MAX_PROFILE_PAGE_SIZE))
  ) {
    throw new ConvexError(
      `Page size must be a safe integer between 1 and ${MAX_PROFILE_PAGE_SIZE}.`,
    );
  }
}

async function toAuthorCard(
  ctx: QueryCtx,
  summary: Doc<"discoverPosts">,
): Promise<AuthorCard> {
  return {
    postId: summary.postId,
    title: summary.title,
    imageUrl: summary.imageStorageId
      ? await ctx.storage.getUrl(summary.imageStorageId)
      : null,
    likeCount: summary.likeCount,
  };
}

export async function summariesToCards(
  ctx: QueryCtx,
  summaries: readonly Doc<"discoverPosts">[],
): Promise<AuthorCard[]> {
  return await Promise.all(
    summaries.map((summary) => toAuthorCard(ctx, summary)),
  );
}

/**
 * Resolves the given post IDs to compact cards in argument order, dropping any
 * entry that is not a currently published projection of this author. Reads stay
 * bounded to the nine-post selection maximum.
 */
export async function hydrateAuthorCards(
  ctx: QueryCtx,
  authorId: string,
  postIds: readonly Id<"posts">[],
): Promise<AuthorCard[]> {
  const cards: AuthorCard[] = [];
  for (const postId of postIds.slice(0, MAX_SELECTED_POSTS)) {
    const summary = await ctx.db
      .query("discoverPosts")
      .withIndex("by_postId", (q) => q.eq("postId", postId))
      .unique();
    if (!summary || summary.authorId !== authorId) continue;
    cards.push(await toAuthorCard(ctx, summary));
  }
  return cards;
}

async function latestAuthorCards(
  ctx: QueryCtx,
  authorId: string,
): Promise<AuthorCard[]> {
  const summaries = await ctx.db
    .query("discoverPosts")
    .withIndex("by_authorId_and_publishedAt", (q) => q.eq("authorId", authorId))
    .order("desc")
    .take(SHOWCASE_LATEST_COUNT);
  return await summariesToCards(ctx, summaries);
}

/**
 * The author showcase: surviving ordered selections when any remain, otherwise
 * the latest three published posts.
 */
export async function readShowcase(
  ctx: QueryCtx,
  authorId: string,
): Promise<Showcase> {
  const author = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", authorId))
    .unique();
  const selected = await hydrateAuthorCards(
    ctx,
    authorId,
    author?.selectedPostIds ?? [],
  );
  if (selected.length > 0) return { mode: "selected", posts: selected };
  return { mode: "latest", posts: await latestAuthorCards(ctx, authorId) };
}

async function assertSelectablePosts(
  ctx: MutationCtx,
  user: Doc<"users">,
  postIds: readonly Id<"posts">[],
): Promise<void> {
  if (postIds.length > MAX_SELECTED_POSTS) {
    throw new ConvexError(`Select at most ${MAX_SELECTED_POSTS} posts.`);
  }
  if (new Set(postIds).size !== postIds.length) {
    throw new ConvexError("Selection contains duplicates.");
  }
  for (const postId of postIds) {
    const post = await ctx.db.get(postId);
    if (!post || post.authorId !== user.userId || post.status !== "published") {
      throw new ConvexError("Choose only your own published posts.");
    }
    if (!post.imageStorageId) {
      throw new ConvexError("Only posts with a cover can be selected.");
    }
  }
}

/** Revision-checked, ordered selection write over the author's own posts. */
export async function saveSelection(
  ctx: MutationCtx,
  user: Doc<"users">,
  expectedRevision: number,
  postIds: readonly Id<"posts">[],
): Promise<RevisionSave> {
  assertExpectedRevision(expectedRevision);
  if (postIds.length > MAX_SELECTED_POSTS) {
    throw new ConvexError(`Select at most ${MAX_SELECTED_POSTS} posts.`);
  }
  if (new Set(postIds).size !== postIds.length) {
    throw new ConvexError("Selection contains duplicates.");
  }
  const revision = user.selectionRevision ?? 0;
  if (expectedRevision !== revision) return { kind: "conflict" };
  await assertSelectablePosts(ctx, user, postIds);
  await ctx.db.patch(user._id, {
    selectedPostIds: [...postIds],
    selectionRevision: revision + 1,
  });
  return { kind: "saved", revision: revision + 1 };
}

/**
 * Removes a deleted post from the author's selection, preserving the surviving
 * order and advancing the selection revision only when the ID was selected.
 */
export async function removeDeletedSelection(
  ctx: MutationCtx,
  authorId: string,
  postId: Id<"posts">,
): Promise<void> {
  const author = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", authorId))
    .unique();
  if (!author) return;
  const selected = author.selectedPostIds ?? [];
  if (!selected.includes(postId)) return;
  await ctx.db.patch(author._id, {
    selectedPostIds: selected.filter((id) => id !== postId),
    selectionRevision: (author.selectionRevision ?? 0) + 1,
  });
}
