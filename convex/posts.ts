/**
 * Blog post queries and mutations.
 * Defines Convex operations for creating, listing, and retrieving posts,
 * plus server-side image URL resolution and pre-signed upload URL generation.
 * All write paths require an active Better Auth session.
 */

import { mutation, query } from "./_generated/server";

import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { isCanonicalPostTag } from "../lib/constants/post-tags";
import {
  MAX_POST_TEXT_LENGTH,
  MIN_POST_TEXT_LENGTH,
  extractPlainText,
  extractImageStorageIds,
  parsePostBody,
} from "../lib/post-content";
import { getPublishedPost } from "./postLifecycle";
import { executeOwnedAttempt, writeProposalValidator } from "./writeAttempts";
import { decrementPostCountInTransaction } from "./stats";
import { deletePublishedPostProjection } from "./discoverProjection";
import { adjustPublishedPostCount } from "./profilePostCount";
const MAX_PUBLIC_PAGE_SIZE = 20;
const postFieldsValidator = {
  _id: v.id("posts"),
  _creationTime: v.number(),
  title: v.string(),
  body: v.string(),
  tags: v.array(v.string()),
  authorId: v.string(),
  imageStorageId: v.optional(v.id("_storage")),
  status: v.union(v.literal("draft"), v.literal("published")),
  publishedAt: v.optional(v.number()),
  commentCount: v.number(),
  likeCount: v.number(),
  uniqueViewCount: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
};
const hydratedPostValidator = v.object({
  ...postFieldsValidator,
  imageUrl: v.union(v.string(), v.null()),
  authorName: v.union(v.string(), v.null()),
  authorAvatarUrl: v.union(v.string(), v.null()),
  isLiked: v.boolean(),
  isBookmarked: v.boolean(),
});
const draftValidator = v.object({
  _id: v.id("posts"),
  title: v.string(),
  body: v.string(),
  tags: v.array(v.string()),
  imageStorageId: v.union(v.id("_storage"), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  inlineImages: v.array(
    v.object({
      storageId: v.id("_storage"),
      url: v.union(v.string(), v.null()),
    }),
  ),
  updatedAt: v.number(),
});
const draftListItemValidator = v.object({
  _id: v.id("posts"),
  title: v.string(),
  tags: v.array(v.string()),
  updatedAt: v.number(),
  excerpt: v.string(),
});
function validatePublicPagination(options: {
  numItems: number;
  maximumRowsRead?: number;
}) {
  if (
    !Number.isSafeInteger(options.numItems) ||
    options.numItems < 1 ||
    options.numItems > MAX_PUBLIC_PAGE_SIZE ||
    (options.maximumRowsRead !== undefined &&
      (!Number.isSafeInteger(options.maximumRowsRead) ||
        options.maximumRowsRead < 1 ||
        options.maximumRowsRead > MAX_PUBLIC_PAGE_SIZE))
  ) {
    throw new ConvexError("Page size must be a safe integer between 1 and 20.");
  }
}

/**
 * Parses a post body string and returns the structured document if valid.
 *
 * @param body - The JSON post body string to parse
 * @returns The parsed BlockNote document, or null if invalid
 */
function getStructuredPostBody(body: string) {
  const parsed = parsePostBody(body);
  return parsed.kind === "structured" ? parsed.document : null;
}

/**
 * Validates that a post body is suitable for saving as a draft.
 * Checks structure and maximum text length.
 *
 * @param body - The post body JSON string to validate
 * @returns True if the body is valid for a draft
 */
export function isValidDraftPostBody(body: string): boolean {
  const document = getStructuredPostBody(body);
  if (!document) return false;

  return (
    extractPlainText(document.blocks).trim().length <= MAX_POST_TEXT_LENGTH
  );
}

/**
 * Validates that a post body meets the requirements for publishing.
 * Checks both minimum and maximum text length constraints.
 *
 * @param body - The post body JSON string to validate
 * @returns True if the body meets publishing requirements
 */
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

/**
 * Validates inline upload claims against provided storage IDs.
 * Ensures each claim is owned by the user, not consumed, and not expired.
 *
 * @param storageIds - Array of storage IDs to validate
 * @param claims - Corresponding upload claims (may contain nulls)
 * @param userId - The user who should own the uploads
 * @param now - Current timestamp
 * @returns Array of validated pending upload claim IDs
 * @throws ConvexError if any claim is invalid or expired
 */
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

export const saveDraft = mutation({
  args: {
    attemptId: v.id("writeAttempts"),
    proposal: writeProposalValidator,
  },
  returns: v.object({
    postId: v.id("posts"),
    updatedAt: v.number(),
    status: v.literal("draft"),
  }),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");
    const result = await executeOwnedAttempt(
      ctx,
      user._id,
      args.attemptId,
      args.proposal,
      "save-draft",
    );
    return { ...result, status: "draft" as const };
  },
});

export const publishPost = mutation({
  args: {
    attemptId: v.id("writeAttempts"),
    proposal: writeProposalValidator,
  },
  returns: v.object({
    postId: v.id("posts"),
    updatedAt: v.number(),
    status: v.literal("published"),
  }),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");
    const result = await executeOwnedAttempt(
      ctx,
      user._id,
      args.attemptId,
      args.proposal,
      "publish",
    );
    return { ...result, status: "published" as const };
  },
});

export const getDrafts = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(draftListItemValidator),
  handler: async (ctx, args) => {
    validatePublicPagination(args.paginationOpts);
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
      .withIndex("by_authorId_and_status_and_updatedAt", (q) =>
        q.eq("authorId", user._id).eq("status", "draft"),
      )
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
          tags: draft.tags,
          updatedAt: draft.updatedAt,
          excerpt,
        };
      }),
    };
  },
});

export const getDraftById = query({
  args: { draftId: v.id("posts") },
  returns: v.union(draftValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.authorId !== user._id || draft.status !== "draft") {
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
      tags: draft.tags,
      imageStorageId: draft.imageStorageId ?? null,
      imageUrl,
      inlineImages,
      updatedAt: draft.updatedAt,
    };
  },
});

export const getPublishedPostForEditing = query({
  args: { postId: v.id("posts") },
  returns: v.union(
    v.object({
      _id: v.id("posts"),
      title: v.string(),
      body: v.string(),
      tags: v.array(v.string()),
      imageStorageId: v.union(v.id("_storage"), v.null()),
      imageUrl: v.union(v.string(), v.null()),
      inlineImages: v.array(
        v.object({
          storageId: v.id("_storage"),
          url: v.union(v.string(), v.null()),
        }),
      ),
      publishedAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const post = await ctx.db.get(args.postId);
    if (!post || post.authorId !== user._id || post.status !== "published") {
      return null;
    }

    const parsed = parsePostBody(post.body);
    if (parsed.kind !== "structured" || post.publishedAt === undefined) {
      return null;
    }
    const imageUrl = post.imageStorageId
      ? await ctx.storage.getUrl(post.imageStorageId)
      : null;
    const inlineStorageIds = extractImageStorageIds(
      parsed.document.blocks,
    ) as Id<"_storage">[];
    const inlineImages = await Promise.all(
      inlineStorageIds.map(async (storageId) => ({
        storageId,
        url: await ctx.storage.getUrl(storageId),
      })),
    );

    return {
      _id: post._id,
      title: post.title,
      body: post.body,
      tags: post.tags,
      imageStorageId: post.imageStorageId ?? null,
      imageUrl,
      inlineImages,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
    };
  },
});

export const updatePublishedPost = mutation({
  args: {
    attemptId: v.id("writeAttempts"),
    proposal: writeProposalValidator,
  },
  returns: v.object({
    postId: v.id("posts"),
    updatedAt: v.number(),
    status: v.literal("published"),
  }),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");
    const result = await executeOwnedAttempt(
      ctx,
      user._id,
      args.attemptId,
      args.proposal,
      "update-post",
    );
    return { ...result, status: "published" as const };
  },
});

export const deleteDraft = mutation({
  args: { draftId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");

    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.authorId !== user._id || draft.status !== "draft") {
      throw new ConvexError("Post not found.");
    }

    const existingJob = await ctx.db
      .query("draftUploadCleanupJobs")
      .withIndex("by_postId", (q) => q.eq("postId", draft._id))
      .unique();
    const now = Date.now();
    const leaseVersion = (existingJob?.leaseVersion ?? 0) + 1;
    const jobId =
      existingJob?._id ??
      (await ctx.db.insert("draftUploadCleanupJobs", {
        postId: draft._id,
        cursor: null,
        lockedUntil: 0,
        updatedAt: now,
        storageIds: [],
        retainedStorageIds: [],
        removeConsumed: true,
        leaseVersion,
      }));
    if (existingJob) {
      await ctx.db.patch(existingJob._id, {
        cursor: null,
        lockedUntil: 0,
        updatedAt: now,
        retainedStorageIds: [],
        removeConsumed: true,
        leaseVersion,
      });
    }
    await ctx.db.delete(draft._id);
    await ctx.scheduler.runAfter(
      0,
      internal.postDeletion.continueDraftUploadCleanup,
      { jobId, leaseVersion },
    );
    return null;
  },
});

export const deletePublishedPost = mutation({
  args: { postId: v.id("posts") },
  returns: v.object({ started: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");

    const post = await ctx.db.get(args.postId);
    if (!post || post.authorId !== user._id || post.status !== "published") {
      throw new ConvexError("Post not found.");
    }

    const existingJob = await ctx.db
      .query("postDeletionJobs")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .unique();
    const jobId =
      existingJob?._id ??
      (await ctx.db.insert("postDeletionJobs", {
        postId: post._id,
        authorId: post.authorId,
        imageStorageId: post.imageStorageId,
        likeCount: post.likeCount,
        uniqueViewCount: post.uniqueViewCount ?? 0,
        stage: "pendingUploads",
        cursor: null,
        commentCursor: null,
        commentLikeCursor: null,
        lockedUntil: 0,
        updatedAt: Date.now(),
        leaseVersion: 1,
      }));
    await deletePublishedPostProjection(ctx, post._id);
    await ctx.db.delete(post._id);
    await decrementPostCountInTransaction(ctx);
    await adjustPublishedPostCount(ctx, post.authorId, -1);
    await ctx.scheduler.runAfter(
      0,
      internal.postDeletion.continuePublishedPostDeletion,
      {
        jobId,
        leaseVersion: 1,
      },
    );
    return { started: true };
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
  returns: paginationResultValidator(hydratedPostValidator),
  handler: async (ctx, args) => {
    validatePublicPagination(args.paginationOpts);
    if (args.tag !== undefined && !isCanonicalPostTag(args.tag)) {
      return {
        page: [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
      };
    }

    const result = await ctx.db
      .query("posts")
      .withIndex("by_status_and_publishedAt", (q) =>
        q.eq("status", "published"),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const sourcePage = result.page.filter(
      (post) => args.tag === undefined || post.tags.includes(args.tag),
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
        let isBookmarked = false;
        if (authUser) {
          const like = await ctx.db
            .query("likes")
            .withIndex("by_postId_and_userId", (q) =>
              q.eq("postId", post._id).eq("userId", authUser._id),
            )
            .unique();
          isLiked = !!like;
          const bookmark = await ctx.db
            .query("bookmarks")
            .withIndex("by_userId_and_postId", (q) =>
              q.eq("userId", authUser._id).eq("postId", post._id),
            )
            .unique();
          isBookmarked = !!bookmark;
        }

        return {
          ...post,
          tags: post.tags,
          imageUrl,
          authorName: user?.displayName ?? null,
          authorAvatarUrl: user?.avatarUrl ?? null,
          isLiked,
          isBookmarked,
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
/**
 * Returns the total number of blog posts via the denormalized stats table.
 *
 * Used by the landing page stats section to display live community metrics.
 *
 * @returns `number`: The total count of posts from the `stats` table.
 */
export const countPosts = query({
  args: {},
  returns: v.number(),
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
  returns: v.union(
    v.object({
      ...postFieldsValidator,
      imageUrl: v.union(v.string(), v.null()),
      inlineImages: v.array(
        v.object({
          storageId: v.id("_storage"),
          url: v.union(v.string(), v.null()),
        }),
      ),
      isLiked: v.boolean(),
      isBookmarked: v.boolean(),
    }),
    v.null(),
  ),
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
    let isBookmarked = false;
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (authUser) {
      const like = await ctx.db
        .query("likes")
        .withIndex("by_postId_and_userId", (q) =>
          q.eq("postId", post._id).eq("userId", authUser._id),
        )
        .unique();
      isLiked = !!like;
      const bookmark = await ctx.db
        .query("bookmarks")
        .withIndex("by_userId_and_postId", (q) =>
          q.eq("userId", authUser._id).eq("postId", post._id),
        )
        .unique();
      isBookmarked = !!bookmark;
    }

    return {
      ...post,
      tags: post.tags,
      imageUrl: resolvedImageUrl,
      inlineImages,
      isLiked,
      isBookmarked,
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
  returns: paginationResultValidator(hydratedPostValidator),
  handler: async (ctx, args) => {
    validatePublicPagination(args.paginationOpts);
    const result = await ctx.db
      .query("posts")
      .withIndex("by_authorId_and_status_and_publishedAt", (q) =>
        q.eq("authorId", args.authorId).eq("status", "published"),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.authorId))
      .unique();

    const authUser = await authComponent.safeGetAuthUser(ctx);

    const page = await Promise.all(
      result.page.map(async (post) => {
        const imageUrl = post.imageStorageId
          ? await ctx.storage.getUrl(post.imageStorageId)
          : null;

        let isLiked = false;
        let isBookmarked = false;
        if (authUser) {
          const like = await ctx.db
            .query("likes")
            .withIndex("by_postId_and_userId", (q) =>
              q.eq("postId", post._id).eq("userId", authUser._id),
            )
            .unique();
          isLiked = !!like;
          const bookmark = await ctx.db
            .query("bookmarks")
            .withIndex("by_userId_and_postId", (q) =>
              q.eq("userId", authUser._id).eq("postId", post._id),
            )
            .unique();
          isBookmarked = !!bookmark;
        }

        return {
          ...post,
          tags: post.tags,
          imageUrl,
          authorName: user?.displayName ?? null,
          authorAvatarUrl: user?.avatarUrl ?? null,
          isLiked,
          isBookmarked,
        };
      }),
    );
    return { ...result, page };
  },
});
