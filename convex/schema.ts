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
    /**
     * Denormalized like counter, kept in sync by the `toggleLike` mutation.
     * Optional for backward compatibility with posts created before Phase 1.2;
     * UI consumers should fall back to 0 via `post.likeCount ?? 0`.
     */
    likeCount: v.optional(v.number()),
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
    likeCount: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_postId", ["postId"]),

  /**
   * Individual like records, one per user per post. Stored as a separate
   * table rather than an array on the post document to avoid hitting the
   * 1 MB document limit and to keep the post document small for reads
   * that don't need like data (Convex schema guideline: no unbounded
   * arrays in documents).
   *
   * The compound index supports both "did this user like this post?"
   * (exact match on both fields) and "all likes for this post" (prefix
   * query on `postId`).
   */
  likes: defineTable({
    postId: v.id("posts"),
    userId: v.string(),
    createdAt: v.number(),
  }).index("by_postId_and_userId", ["postId", "userId"]),

  /**
   * Individual comment-like records, one per user per comment. Mirrors the
   * `likes` table pattern: separate table (not an array on the comment doc)
   * to keep the comment document small and avoid the 1 MB document limit.
   *
   * The compound index supports both "did this user like this comment?"
   * (exact match on both fields) and "all likes for this comment" (prefix
   * query on `commentId`).
   */
  commentLikes: defineTable({
    commentId: v.id("comments"),
    userId: v.string(),
    createdAt: v.number(),
  }).index("by_commentId_and_userId", ["commentId", "userId"]),

  /**
   * Individual follow relationships, one per follower per followed
   * author. Mirrors the `likes` table pattern: separate table (not an
   * array on the user doc) to keep the user document small and avoid
   * the 1 MB document limit.
   *
   * `followerId` and `followingId` are Better Auth user ID strings
   * (same shape as `posts.authorId` and `likes.userId`), not Convex
   * `users._id` values. The compound index supports the
   * `toggleFollow` `.unique()` probe (exact match on both fields) and
   * the future 1.7 Reader Feed prefix scan on `followerId`.
   */
  follows: defineTable({
    followerId: v.string(),
    followingId: v.string(),
    createdAt: v.number(),
  }).index("by_followerId_and_followingId", ["followerId", "followingId"]),

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
    /**
     * Denormalized follower/following counts, kept in sync by the
     * `toggleFollow` mutation. Optional for backward compatibility with
     * user docs created before Phase 1.4; UI consumers should fall back
     * to 0 via `user.followerCount ?? 0` / `user.followingCount ?? 0`.
     */
    followerCount: v.optional(v.number()),
    followingCount: v.optional(v.number()),
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
