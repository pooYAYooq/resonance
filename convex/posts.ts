/**
 * Blog post queries and mutations.
 * Defines Convex operations for creating, listing, and retrieving posts,
 * plus server-side image URL resolution and pre-signed upload URL generation.
 * All write paths require an active Better Auth session.
 */

import { mutation, query, type MutationCtx } from "./_generated/server";

import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import { paginationOptsValidator } from "convex/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { FANOUT_BATCH_SIZE } from "./notifications";
import { FEED_BATCH_SIZE } from "./feed";
import {
  isCanonicalPostTag,
  isValidPostTags,
} from "../lib/constants/post-tags";
import {
  MAX_POST_TEXT_LENGTH,
  MIN_POST_TEXT_LENGTH,
  extractPlainText,
  extractImageStorageIds,
  parsePostBody,
} from "../lib/post-content";
import {
  getPostStatus,
  getPublishedPost,
  validateDraftUploadClaims,
} from "./postLifecycle";
import { incrementPostCountInTransaction } from "./stats";

function getStructuredPostBody(body: string) {
  const parsed = parsePostBody(body);
  return parsed.kind === "structured" ? parsed.document : null;
}

export function isValidDraftPostBody(body: string): boolean {
  const document = getStructuredPostBody(body);
  if (!document) return false;

  return (
    extractPlainText(document.blocks).trim().length <= MAX_POST_TEXT_LENGTH
  );
}

export function isValidPublishPostBody(body: string): boolean {
  if (!isValidDraftPostBody(body)) return false;
  const document = getStructuredPostBody(body);
  if (!document) return false;
  const textLength = extractPlainText(document.blocks).trim().length;
  return textLength >= MIN_POST_TEXT_LENGTH;
}

type InlineUploadClaim = Pick<
  Doc<"pendingUploads">,
  "_id" | "userId" | "storageId" | "expiresAt" | "consumedAt"
>;

export function validateInlineUploadClaims(
  storageIds: Id<"_storage">[],
  claims: (InlineUploadClaim | null)[],
  userId: string,
  now: number,
): Id<"pendingUploads">[] {
  return storageIds.map((storageId, index) => {
    const claim = claims[index];
    if (
      !claim ||
      claim.userId !== userId ||
      claim.storageId === undefined ||
      claim.storageId !== storageId ||
      claim.consumedAt !== undefined
    ) {
      throw new ConvexError("Invalid inline upload claim");
    }
    if (claim.expiresAt <= now) {
      throw new ConvexError("Inline image expired");
    }
    return claim._id;
  });
}

async function deleteRemovedDraftClaims(
  ctx: MutationCtx,
  draftId: Id<"posts">,
  retainedStorageIds: Set<string>,
) {
  const claims = ctx.db
    .query("pendingUploads")
    .withIndex("by_postId", (q) => q.eq("postId", draftId));

  for await (const claim of claims) {
    if (
      claim.consumedAt === undefined &&
      (claim.storageId === undefined ||
        !retainedStorageIds.has(claim.storageId))
    ) {
      if (claim.storageId !== undefined) {
        await ctx.storage.delete(claim.storageId);
      }
      await ctx.db.delete(claim._id);
    }
  }
}

function getReferencedStorageIds(
  body: string,
  imageStorageId?: Id<"_storage">,
): Id<"_storage">[] {
  const document = getStructuredPostBody(body);
  if (!document) return [];
  return [
    ...(imageStorageId === undefined ? [] : [imageStorageId]),
    ...(extractImageStorageIds(document.blocks) as Id<"_storage">[]),
  ];
}

export const saveDraft = mutation({
  args: {
    draftId: v.optional(v.id("posts")),
    title: v.string(),
    body: v.string(),
    tags: v.optional(v.array(v.string())),
    imageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.object({
    draftId: v.id("posts"),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");

    const tags = args.tags ?? [];
    if (args.title.length > 100) throw new ConvexError("Invalid title");
    if (!isValidDraftPostBody(args.body)) {
      throw new ConvexError("Invalid content");
    }
    if (!isValidPostTags(tags)) throw new ConvexError("Invalid tags");

    const now = Date.now();
    const draft =
      args.draftId === undefined ? null : await ctx.db.get(args.draftId);
    if (
      args.draftId !== undefined &&
      (!draft ||
        draft.authorId !== user._id ||
        getPostStatus(draft) !== "draft")
    ) {
      throw new ConvexError("Post not found.");
    }

    const referencedStorageIds = getReferencedStorageIds(
      args.body,
      args.imageStorageId,
    );
    const claimIds = await validateDraftUploadClaims(
      ctx,
      referencedStorageIds,
      user._id,
      now,
      draft?._id,
    );
    const retainedStorageIds = new Set(referencedStorageIds);

    if (draft) {
      await deleteRemovedDraftClaims(ctx, draft._id, retainedStorageIds);
      await ctx.db.patch(draft._id, {
        title: args.title,
        body: args.body,
        tags,
        imageStorageId: args.imageStorageId,
        updatedAt: now,
      });
    } else {
      const draftId = await ctx.db.insert("posts", {
        title: args.title,
        body: args.body,
        tags,
        imageStorageId: args.imageStorageId,
        authorId: user._id,
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      for (const claimId of claimIds) {
        await ctx.db.patch(claimId, {
          postId: draftId,
          expiresAt: Number.MAX_SAFE_INTEGER,
        });
      }
      return { draftId, updatedAt: now };
    }

    for (const claimId of claimIds) {
      await ctx.db.patch(claimId, {
        postId: draft._id,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
    }
    return { draftId: draft._id, updatedAt: now };
  },
});

export const publishPost = mutation({
  args: { draftId: v.id("posts") },
  returns: v.id("posts"),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");

    const draft = await ctx.db.get(args.draftId);
    if (
      !draft ||
      draft.authorId !== user._id ||
      getPostStatus(draft) !== "draft"
    ) {
      throw new ConvexError("Post not found.");
    }
    if (
      draft.title.trim().length === 0 ||
      !isValidPublishPostBody(draft.body)
    ) {
      throw new ConvexError("Invalid content");
    }
    if (!isValidPostTags(draft.tags ?? [])) {
      throw new ConvexError("Invalid tags");
    }

    const now = Date.now();
    const referencedStorageIds = getReferencedStorageIds(
      draft.body,
      draft.imageStorageId,
    );
    const claimIds = await validateDraftUploadClaims(
      ctx,
      referencedStorageIds,
      user._id,
      now,
      draft._id,
    );

    await ctx.db.patch(draft._id, {
      status: "published",
      publishedAt: draft.publishedAt ?? now,
      updatedAt: now,
    });
    for (const claimId of claimIds) {
      await ctx.db.patch(claimId, {
        consumedAt: now,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
    }
    await incrementPostCountInTransaction(ctx);
    await ctx.scheduler.runAfter(0, internal.notifications.fanOutForPost, {
      postId: draft._id,
      authorId: draft.authorId,
      paginationOpts: { numItems: FANOUT_BATCH_SIZE, cursor: null },
    });
    await ctx.scheduler.runAfter(0, internal.feed.fanOutForPost, {
      postId: draft._id,
      authorId: draft.authorId,
      paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
      retryCount: 0,
    });

    return draft._id;
  },
});

export const getDrafts = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return {
        page: [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
      };
    }

    const result = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("authorId", user._id))
      .filter((q) => q.eq(q.field("status"), "draft"))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((draft) => {
        const parsed = parsePostBody(draft.body);
        const excerpt =
          parsed.kind === "structured"
            ? extractPlainText(parsed.document.blocks).slice(0, 240)
            : "";
        return {
          _id: draft._id,
          title: draft.title,
          tags: draft.tags ?? [],
          updatedAt: draft.updatedAt,
          excerpt,
        };
      }),
    };
  },
});

export const getDraftById = query({
  args: { draftId: v.id("posts") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const draft = await ctx.db.get(args.draftId);
    if (
      !draft ||
      draft.authorId !== user._id ||
      getPostStatus(draft) !== "draft"
    ) {
      return null;
    }

    const imageUrl = draft.imageStorageId
      ? await ctx.storage.getUrl(draft.imageStorageId)
      : null;
    const parsed = parsePostBody(draft.body);
    const inlineStorageIds =
      parsed.kind === "structured"
        ? (extractImageStorageIds(parsed.document.blocks) as Id<"_storage">[])
        : [];
    const inlineImages = await Promise.all(
      inlineStorageIds.map(async (storageId) => ({
        storageId,
        url: await ctx.storage.getUrl(storageId),
      })),
    );

    return {
      _id: draft._id,
      title: draft.title,
      body: draft.body,
      tags: draft.tags ?? [],
      imageStorageId: draft.imageStorageId ?? null,
      imageUrl,
      inlineImages,
      updatedAt: draft.updatedAt,
    };
  },
});

export const deleteDraft = mutation({
  args: { draftId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");

    const draft = await ctx.db.get(args.draftId);
    if (
      !draft ||
      draft.authorId !== user._id ||
      getPostStatus(draft) !== "draft"
    ) {
      throw new ConvexError("Post not found.");
    }

    const claims = ctx.db
      .query("pendingUploads")
      .withIndex("by_postId", (q) => q.eq("postId", draft._id));
    for await (const claim of claims) {
      if (claim.consumedAt !== undefined) continue;
      if (claim.storageId !== undefined) {
        await ctx.storage.delete(claim.storageId);
      }
      await ctx.db.delete(claim._id);
    }
    await ctx.db.delete(draft._id);
    return null;
  },
});

/**
 * Retrieves a paginated list of blog posts, ordered by creation time in descending order.
 *
 * For each post that has an associated image (`imageStorageId`), a signed public URL is
 * resolved server-side via `ctx.storage.getUrl()`. Posts without an image receive
 * `imageUrl: null`. By using `.paginate()`, the total number of posts — and therefore
 * the maximum number of storage lookups per query — is bounded by the caller-supplied
 * `numItems`.
 *
 * Each post is also hydrated with author data (`authorName`, `authorAvatarUrl`) from
 * the `users` table, following the same join pattern as `getCommentsByPostId`.
 *
 * @param paginationOpts - `PaginationOptions`: Convex pagination config such as `numItems` and cursor.
 * @returns `PaginationResult`: Paginated result where `page` contains posts with a
 *   server-resolved `imageUrl` (`string | null`), `commentCount`, `authorName`,
 *   `authorAvatarUrl`, `isLiked`, plus `isDone` and `continueCursor`.
 */
export const getPosts = query({
  args: {
    paginationOpts: paginationOptsValidator,
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.tag !== undefined && !isCanonicalPostTag(args.tag)) {
      return {
        page: [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
      };
    }

    const result = await ctx.db
      .query("posts")
      .order("desc")
      .paginate(args.paginationOpts);

    const sourcePage = result.page.filter(
      (post) =>
        getPostStatus(post) === "published" &&
        (args.tag === undefined || (post.tags ?? []).includes(args.tag)),
    );

    const authUser = await authComponent.safeGetAuthUser(ctx);

    const page = await Promise.all(
      sourcePage.map(async (post) => {
        const imageUrl = post.imageStorageId
          ? await ctx.storage.getUrl(post.imageStorageId)
          : null;

        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", post.authorId))
          .unique();

        let isLiked = false;
        if (authUser) {
          const like = await ctx.db
            .query("likes")
            .withIndex("by_postId_and_userId", (q) =>
              q.eq("postId", post._id).eq("userId", authUser._id),
            )
            .unique();
          isLiked = !!like;
        }

        return {
          ...post,
          tags: post.tags ?? [],
          imageUrl,
          authorName: user?.displayName ?? null,
          authorAvatarUrl: user?.avatarUrl ?? null,
          isLiked,
        };
      }),
    );

    return { ...result, page };
  },
});

/**
 * Generates a pre-signed upload URL so the client can upload an image directly
 * to Convex storage without exposing storage credentials.
 *
 * @returns `string`: A temporary pre-signed URL valid for a single upload.
 *
 * @throws `ConvexError("Unauthorized")` if the caller has no valid session.
 * @sideEffects Allocates a pre-signed URL on Convex storage; must be consumed
 *   within the URL's expiration window (~1 hour).
 */
export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Unauthorized");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Returns the total number of blog posts via the denormalized stats table.
 *
 * Used by the landing page stats section to display live community metrics.
 *
 * @returns `number`: The total count of posts from the `stats` table.
 */
export const countPosts = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const stats: { totalPosts: number } = await ctx.runQuery(
      api.stats.getStats,
      {},
    );
    return stats.totalPosts;
  },
});

/**
 * Retrieves a single blog post by its document ID, resolving its image URL
 * server-side if one exists.
 *
 * @param postId - `Id<"posts">`: The Convex document ID of the target post.
 * @returns The post object with `imageUrl`, `commentCount`, and `isLiked` fields,
 *   or `null` if not found. `imageUrl` is a signed URL string when the post has an
 *   associated image, or `null` when it does not.
 */
export const getPostById = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await getPublishedPost(ctx, args.postId);
    if (!post) {
      return null;
    }

    const resolvedImageUrl =
      post?.imageStorageId !== undefined
        ? await ctx.storage.getUrl(post.imageStorageId)
        : null;

    const parsedBody = parsePostBody(post.body);
    const inlineStorageIds =
      parsedBody.kind === "structured"
        ? (extractImageStorageIds(
            parsedBody.document.blocks,
          ) as Id<"_storage">[])
        : [];
    const inlineImages = await Promise.all(
      inlineStorageIds.map(async (storageId) => ({
        storageId,
        url: await ctx.storage.getUrl(storageId),
      })),
    );

    let isLiked = false;
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (authUser) {
      const like = await ctx.db
        .query("likes")
        .withIndex("by_postId_and_userId", (q) =>
          q.eq("postId", post._id).eq("userId", authUser._id),
        )
        .unique();
      isLiked = !!like;
    }

    return {
      ...post,
      tags: post.tags ?? [],
      imageUrl: resolvedImageUrl,
      inlineImages,
      isLiked,
    };
  },
});

/**
 * Retrieves a paginated list of posts by a specific author.
 *
 * Uses the `by_authorId` index to filter posts, ordered by creation time
 * descending. Hydrates each post with:
 * - `imageUrl` from storage (same as `getPosts`)
 * - `authorName` and `authorAvatarUrl` from the `users` table (same join
 *   pattern as `getCommentsByPostId`)
 *
 * @param args.authorId - `string`: Better Auth user ID of the author.
 * @param args.paginationOpts - `PaginationOptions`: Convex pagination config.
 * @returns `PaginationResult`: Paginated posts with hydrated author data and `isLiked`.
 */
export const getPostsByAuthorId = query({
  args: {
    authorId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("authorId", args.authorId))
      .order("desc")
      .paginate(args.paginationOpts);

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.authorId))
      .unique();

    const authUser = await authComponent.safeGetAuthUser(ctx);

    const sourcePage = result.page.filter(
      (post) => getPostStatus(post) === "published",
    );

    const page = await Promise.all(
      sourcePage.map(async (post) => {
        const imageUrl = post.imageStorageId
          ? await ctx.storage.getUrl(post.imageStorageId)
          : null;

        let isLiked = false;
        if (authUser) {
          const like = await ctx.db
            .query("likes")
            .withIndex("by_postId_and_userId", (q) =>
              q.eq("postId", post._id).eq("userId", authUser._id),
            )
            .unique();
          isLiked = !!like;
        }

        return {
          ...post,
          tags: post.tags ?? [],
          imageUrl,
          authorName: user?.displayName ?? null,
          authorAvatarUrl: user?.avatarUrl ?? null,
          isLiked,
        };
      }),
    );
    return { ...result, page };
  },
});
