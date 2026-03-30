import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";

// Create a new blog article.
export const createPost = mutation({
  args: { title: v.string(), body: v.string() },
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
    return posts;
  },
});
