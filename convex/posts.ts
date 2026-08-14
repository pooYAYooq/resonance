/**
 * Blog post queries and mutations.
 * Defines Convex operations for creating, listing, and retrieving posts,
 * plus server-side image URL resolution and pre-signed upload URL generation.
 * All write paths require an active Better Auth session.
 */

import { mutation, query } from "./_generated/server";

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

export function isValidCreatePostBody(body: string): boolean {
  const parsed = parsePostBody(body);
  if (parsed.kind === "legacy") return true;
  if (parsed.kind === "invalid") return false;

  const textLength = extractPlainText(parsed.document.blocks).trim().length;
  return (
    textLength >= MIN_POST_TEXT_LENGTH && textLength <= MAX_POST_TEXT_LENGTH
  );
}

type InlineUploadClaim = Pick<
  Doc<"pendingUploads">,
  "_id" | "userId" | "storageId" | "expiresAt"
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
      claim.storageId !== storageId
    ) {
      throw new ConvexError("Invalid inline upload claim");
    }
    if (claim.expiresAt <= now) {
      throw new ConvexError("Inline image expired");
    }
    return claim._id;
  });
}

/**
 * Creates a new blog article authored by the currently authenticated user.
 *
 * @param title - `string`: The article's display title.
 * @param body - `string`: The article's Markdown or HTML body content.
 * @param imageStorageId - `Id<"_storage"> | undefined`: Optional storage ID for the post's
 *   cover image. Pass `undefined` when no image is attached.
 * @returns `Id<"posts">`: The auto-generated document ID of the newly inserted post.
 *
 * @throws `ConvexError("Unauthorized")` if the caller has no valid session.
 */
export const createPost = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    tags: v.optional(v.array(v.string())),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Unauthorized");
    }

    const tags = args.tags ?? [];
    if (!isValidPostTags(tags)) {
      throw new ConvexError("Invalid tags");
    }
    if (!isValidCreatePostBody(args.body)) {
      throw new ConvexError("Invalid content");
    }

    const now = Date.now();
    const parsedBody = parsePostBody(args.body);
    const inlineStorageIds: Id<"_storage">[] =
      parsedBody.kind === "structured"
        ? (extractImageStorageIds(
            parsedBody.document.blocks,
          ) as Id<"_storage">[])
        : [];
    const inlineClaims = await Promise.all(
      inlineStorageIds.map(async (storageId) => {
        const matchingClaims = await ctx.db
          .query("pendingUploads")
          .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
          .take(2);
        return matchingClaims.length === 1 ? matchingClaims[0] : null;
      }),
    );
    const consumedInlineUploadIds = validateInlineUploadClaims(
      inlineStorageIds,
      inlineClaims,
      user._id,
      now,
    );

    const blogArticle = await ctx.db.insert("posts", {
      title: args.title,
      body: args.body,
      tags,
      imageStorageId: args.imageStorageId,
      authorId: user._id,
      commentCount: 0,
      likeCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    for (const sessionId of consumedInlineUploadIds) {
      await ctx.db.delete(sessionId);
    }

    await ctx.runMutation(internal.stats.incrementPostCount, {});
    try {
      await ctx.runMutation(internal.notifications.fanOutForPost, {
        postId: blogArticle,
        authorId: user._id,
        paginationOpts: { numItems: FANOUT_BATCH_SIZE, cursor: null },
      });
    } catch (error) {
      // The fan-out's own writes (notification rows, counter bumps)
      // have rolled back because Convex subtransactions are
      // independent — but the post insert and stats increment above
      // stay committed. The post is the source of truth; the
      // notification is a hint. Log and continue so the user gets
      // their post ID and a success toast.
      console.error("notifications.fanOutForPost failed", error);
    }
    try {
      await ctx.runMutation(internal.feed.fanOutForPost, {
        postId: blogArticle,
        authorId: user._id,
        paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
        retryCount: 0,
      });
    } catch (error) {
      console.error("feed.fanOutForPost failed", error);
      await ctx.scheduler.runAfter(0, internal.feed.fanOutForPost, {
        postId: blogArticle,
        authorId: user._id,
        paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
        retryCount: 1,
      });
    }

    return blogArticle;
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

    const sourcePage = args.tag
      ? result.page.filter((post) => (post.tags ?? []).includes(args.tag!))
      : result.page;

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
    const post = await ctx.db.get(args.postId);
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
        ? (extractImageStorageIds(parsedBody.document.blocks) as Id<"_storage">[])
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

    const page = await Promise.all(
      result.page.map(async (post) => {
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
