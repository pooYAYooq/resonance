import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";

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

// Get all blog articles.
export const getPosts = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").order("desc").collect();

    // Hydrate each post with a public image URL. We resolve storage URLs server-side
    // so the client receives ready-to-use links without needing direct storage access.
    const postsWithImageUrl = await Promise.all(
      posts.map(async (post) => {
        let imageUrl = null;
        if (post.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(post.imageStorageId);
        }
        return { ...post, imageUrl };
      }),
    );

    return postsWithImageUrl;
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
