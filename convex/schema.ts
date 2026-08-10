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
 * - `feed` is a bounded 30-day materialized view, not the source of truth for author history.
 * - Timestamps (`createdAt`, `updatedAt`) are required on all tables.
 */
export default defineSchema({
  /** Blog posts. Each post belongs to an author and tracks comment count. */
  posts: defineTable({
    title: v.string(),
    body: v.string(),
    /** Optional only for legacy posts; new writes persist a validated array. */
    tags: v.optional(v.array(v.string())),
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
    .index("by_authorId", ["authorId"])
    .index("by_authorId_and_createdAt", ["authorId", "createdAt"]),

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
  })
    .index("by_followerId_and_followingId", ["followerId", "followingId"])
    // `by_followingId` is ordered (followingId, createdAt) so the
    // 1.6 fan-out can resume a batched scan with a `lastCreatedAt`
    // cursor via `.eq("followingId", ...).gt("createdAt", last)`.
    // Without the `createdAt` second column, a scheduler continuation
    // would re-read the same first 200 rows and insert duplicate
    // notifications.
    .index("by_followingId", { fields: ["followingId", "createdAt"] }),

  /**
   * Individual bookmark records, one per user per post. Mirrors the
   * `likes` table pattern: separate table (not an array on the post or
   * user doc) to keep those documents small and avoid the 1 MB document
   * limit.
   *
   * `userId` is the Better Auth user ID string (same shape as
   * `likes.userId` and `follows.followerId`), not the Convex `users._id`.
   * Bookmarks are private: there is no public per-post listing and no
   * denormalized count on `users` or `posts`.
   *
   * Two indexes, both `userId`-first (bookmarks have no public per-post
   * query, unlike `likes.by_postId_and_userId` whose public per-post
   * prefix needs `postId` first):
   *  - `by_userId_and_postId` serves the exact-match `toggleBookmark` /
   *    `isBookmarked` probe (equality on both fields via `.unique()`).
   *  - `by_userId_and_createdAt` serves the `/reading-list` prefix scan:
   *    equality on `userId`, then `.order("desc")` over `createdAt` gives
   *    this user's bookmarks most-recently-saved first. (The
   *    `by_userId_and_postId` index cannot do this — scoped to a `userId`
   *    it orders by `postId`, i.e. by the *post's* creation order, not by
   *    when the bookmark was saved.)
   */
  bookmarks: defineTable({
    userId: v.string(),
    postId: v.id("posts"),
    createdAt: v.number(),
  })
    .index("by_userId_and_postId", ["userId", "postId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),

  /**
   * Individual notification records, one per follower per published
   * post. Mirrors the `likes` / `follows` / `bookmarks` pattern: a
   * separate table, not an array on the user doc, to keep the user
   * document small and avoid the 1 MB document limit (Convex schema
   * guideline: no unbounded arrays in documents).
   *
   * No `read` / `readAt` field — the Medium-High slice's
   * "mark-all-read on page visit" resets the denormalized
   * `users.unreadNotificationCount` rather than tracking per-row
   * state. Adding `readAt: v.optional(v.number())` later is a
   * non-breaking migration if per-row state is wanted (see the spec's
   * Forward pointers).
   *
   * `recipientId` and `actorId` are Better Auth user ID strings
   * (same shape as `follows.followerId` / `follows.followingId` and
   * `posts.authorId`), NOT Convex `users._id`. The compound index
   * supports the paginated newest-first list query (prefix scan on
   * `recipientId` with `.order("desc")`).
   */
  notifications: defineTable({
    recipientId: v.string(),
    actorId: v.string(),
    postId: v.id("posts"),
    createdAt: v.number(),
  }).index("by_recipientId_and_createdAt", ["recipientId", "createdAt"]),

  /**
   * Bounded, denormalized reader feed rows. These rows cover only the most
   * recent 30 days; posts remain the source of truth for an author's history.
   */
  feed: defineTable({
    userId: v.string(),
    postId: v.id("posts"),
    authorId: v.string(),
    followId: v.id("follows"),
    createdAt: v.number(),
    insertedAt: v.number(),
  })
    .index("by_userId_and_createdAt_and_insertedAt_and_postId", [
      "userId",
      "createdAt",
      "insertedAt",
      "postId",
    ])
    .index("by_userId_and_postId", ["userId", "postId"])
    .index("by_userId_and_authorId_and_followId_and_createdAt", [
      "userId",
      "authorId",
      "followId",
      "createdAt",
    ]),

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
    /**
     * Denormalized count of unread notifications, kept in sync by
     * `internal.notifications.fanOutForPost` (increments on fan-out)
     * and `notifications.markAllRead` (resets to 0 on page visit).
     * Optional for backward compatibility with user docs created
     * before Phase 1.6; UI consumers should fall back to 0 via
     * `user.unreadNotificationCount ?? 0`.
     */
    unreadNotificationCount: v.optional(v.number()),
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
