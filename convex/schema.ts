/**
 * Defines the Convex database schema, including tables for posts and comments.
 * Posts store blog article content with an optional image attachment.
 * Comments are linked to posts via a foreign key (`postId`).
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Root Convex schema, registers every table and its validated fields.
 * Convex enforces these validators on insert and uses them to
 * generate TypeScript types in `_generated/dataModel.d.ts`.
 * - `posts` is the main blog post table.
 * - `comments` is the table of comments attached to posts.
 * - `users` is an app-level enrichment table synced from Better Auth identity.
 * - `stats` is a denormalized singleton counter to avoid loading all posts for a count.
 * - Timestamps (`createdAt`, `updatedAt`) are required on all tables.
 */
export default defineSchema({
  /** Blog posts. Each post belongs to an author and tracks comment count. */
  posts: defineTable({
    title: v.string(),
    body: v.string(),
    authorId: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    commentCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    /**
     * Primary lookup: fetch all posts by a given author for profile pages and
     * user-specific post listings without scanning the entire table.
     */
    .index("by_authorId", ["authorId"]),

  /** Comments attached to a single post. */
  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.string(),
    authorName: v.string(),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_postId", ["postId"]),

  /**
   * App-level user enrichment table, synced from Better Auth on sign-in.
   *
   * Why a separate table?
   * Better Auth stores identity, but this table lets us attach app-specific
   * profile fields (bio, avatarUrl, displayName) and query users by those
   * fields without coupling to auth internals.
   *
   * `userId` holds the Better Auth user ID (string), not the Convex doc `_id`.
   */
  users: defineTable({
    userId: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    createdAt: v.number(),
  })
    /**
     * Primary lookup: fetch a user by their Better Auth ID during auth-gated
     * operations (e.g. `syncUser`, `getCurrentUser`).
     */
    .index("by_userId", ["userId"])
    /**
     * Secondary lookup: support future public profile pages or search by
     * display name without scanning the entire table.
     */
    .index("by_displayName", ["displayName"])
    /**
     * Tertiary lookup: support admin features, password resets, and "find user"
     * flows by email address. Added during Phase 0 Task 4 to avoid a future
     * schema migration.
     */
    .index("by_email", ["email"]),

  /**
   * Denormalized site-wide statistics. Currently a single-row table that
   * stores the total number of published posts.
   *
   * Why denormalize?
   * Convex has no built-in count operation, and `.collect().length` loads
   * every post into memory. For a landing page stats section, we need an
   * O(1) read. `incrementPostCount` is called by `createPost` on every
   * successful insert to keep this value accurate.
   */
  stats: defineTable({
    totalPosts: v.number(),
  }),
});
