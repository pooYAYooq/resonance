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
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Unauthorized");
    }

    const now = Date.now();
    const blogArticle = await ctx.db.insert("posts", {
      title: args.title,
      body: args.body,
      imageStorageId: args.imageStorageId,
      authorId: user._id,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.stats.incrementPostCount, {});

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
 *   `authorAvatarUrl`, plus `isDone` and `continueCursor`.
 */
export const getPosts = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("posts")
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (post) => {
        const imageUrl = post.imageStorageId
          ? await ctx.storage.getUrl(post.imageStorageId)
          : null;

        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", post.authorId))
          .unique();

        return {
          ...post,
          imageUrl,
          authorName: user?.displayName ?? null,
          authorAvatarUrl: user?.avatarUrl ?? null,
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
 * @returns The post object with `imageUrl` and `commentCount` fields, or `null` if not found.
 *   `imageUrl` is a signed URL string when the post has an associated image,
 *   or `null` when it does not.
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
    return { ...post, imageUrl: resolvedImageUrl };
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
 * @returns `PaginationResult`: Paginated posts with hydrated author data.
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

    const page = await Promise.all(
      result.page.map(async (post) => {
        const imageUrl = post.imageStorageId
          ? await ctx.storage.getUrl(post.imageStorageId)
          : null;

        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", args.authorId))
          .unique();

        return {
          ...post,
          imageUrl,
          authorName: user?.displayName ?? null,
          authorAvatarUrl: user?.avatarUrl ?? null,
        };
      }),
    );
    return { ...result, page };
  },
});
