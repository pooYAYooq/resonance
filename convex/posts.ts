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
    const blogArticle = await ctx.db.insert("posts", {
      title: args.title,
      body: args.body,
      imageStorageId: args.imageStorageId,
      authorId: user._id,
    });

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
 * @param paginationOpts - `PaginationOptions`: Convex pagination config such as `numItems` and cursor.
 * @returns `PaginationResult`: Paginated result where `page` contains posts with a
 *   server-resolved `imageUrl` (`string | null`) and `commentCount`, plus `isDone`
 *   and `continueCursor`.
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

    // Hydrate each post on the current page with a public image URL.
    // We resolve storage URLs server-side so the client receives ready-to-use links
    // without needing direct storage access. The `if (post.imageStorageId)` guard
    // ensures we only call `getUrl()` for posts that actually have an image.
    const postsWithImageUrl = await Promise.all(
      result.page.map(async (post) => {
        let imageUrl = null;
        if (post.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(post.imageStorageId);
        }
        // Count comments for this post. An empty result yields 0; query failures
        // propagate out of Promise.all and surface to the caller.
        const commentCount = await ctx.db
          .query("comments")
          .withIndex("by_postId", (q) => q.eq("postId", post._id))
          .collect()
          .then((comments) => comments.length);
        return { ...post, imageUrl, commentCount };
      }),
    );

    return {
      page: postsWithImageUrl,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
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
    // Count related comments. An empty result yields 0.
    const commentCount = await ctx.db
      .query("comments")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .collect()
      .then((comments) => comments.length);
    return { ...post, imageUrl: resolvedImageUrl, commentCount };
  },
});
