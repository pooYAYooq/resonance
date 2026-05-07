import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import { paginationOptsValidator } from "convex/server";

// Create a new blog article.
export const createPost = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    // Optional because posts may be created without an image.
    imageStorageId: v.optional(v.id("_storage")),
  },
  /**
   * Inserts a new blog article into the database.
   * Throws an error if the user is not logged in.
   * @returns The newly created blog article.
   */
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Unauthorized");
    }
    const blogArticle = await ctx.db.insert("posts", {
      title: args.title,
      body: args.body,
      imageStorageId: args.imageStorageId, // Optional storage ID for the post image
      authorId: user._id, // Store the user's ID as the author of the post
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
        return { ...post, imageUrl };
      }),
    );

    return {
      page: postsWithImageUrl,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

// Generate a pre-signed URL for uploading an image to storage.
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
