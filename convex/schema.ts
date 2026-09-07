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
    tags: v.array(v.string()),
    authorId: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    status: v.union(v.literal("draft"), v.literal("published")),
    publishedAt: v.optional(v.number()),
    commentCount: v.number(),
    /**
     * Denormalized like counter, kept in sync by the `toggleLike` mutation.
     * Optional for backward compatibility with posts created before Phase 1.2;
     * UI consumers can read this denormalized count directly.
     */
    likeCount: v.number(),
    /**
     * Unique view count, incremented when a new viewer sees the post.
     * Optional for backward compatibility with posts created before analytics were added.
     */
    uniqueViewCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    /**
     * Primary lookup: fetch all posts by a given author for profile pages and
     * user-specific post listings without scanning the entire table.
     */
    .index("by_authorId", ["authorId"])
    .index("by_authorId_and_createdAt", ["authorId", "createdAt"])
    .index("by_status_and_publishedAt", {
      fields: ["status", "publishedAt"],
    })
    .index("by_authorId_and_status_and_publishedAt", {
      fields: ["authorId", "status", "publishedAt"],
    })
    .index("by_authorId_and_status_and_updatedAt", {
      fields: ["authorId", "status", "updatedAt"],
    }),

  /** One durable view record per viewer and post. */
  postViews: defineTable({
    postId: v.id("posts"),
    viewerKey: v.string(),
    createdAt: v.number(),
  }).index("by_postId_and_viewerKey", ["postId", "viewerKey"]),

  /** Per-author counters maintained transactionally with source events. */
  authorAnalytics: defineTable({
    authorId: v.string(),
    uniqueViews: v.number(),
    likesReceived: v.number(),
  }).index("by_authorId", ["authorId"]),

  /** One follower-growth total per author and UTC day. */
  followerGrowthDays: defineTable({
    authorId: v.string(),
    dayStart: v.number(),
    gainedCount: v.number(),
  }).index("by_authorId_and_dayStart", ["authorId", "dayStart"]),

  /** Comments attached to a single post. */
  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.string(),
    authorName: v.string(),
    body: v.string(),
    likeCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_postId", ["postId"])
    .index("by_postId_and_createdAt", ["postId", "createdAt"]),

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
  })
    .index("by_postId_and_userId", ["postId", "userId"])
    .index("by_postId", ["postId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),

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
    .index("by_postId", ["postId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),

  /**
   * Individual notification records, one per follower per published
   * post. `readAt` is optional so legacy rows remain valid and are treated
   * as unread until the bounded mark-all-read job reaches them.
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
    readAt: v.optional(v.number()),
  })
    .index("by_recipientId_and_createdAt", ["recipientId", "createdAt"])
    .index("by_recipientId_and_postId", ["recipientId", "postId"])
    .index("by_postId", ["postId"]),

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
    ])
    .index("by_postId", ["postId"]),

  /**
   * One published-post read-model row per source post for Discover search and
   * Latest ordering. `postId` is the application-enforced unique source key.
   */
  discoverPosts: defineTable({
    postId: v.id("posts"),
    title: v.string(),
    bodyText: v.string(),
    searchableText: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    tags: v.array(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    publishedAt: v.number(),
    commentCount: v.number(),
    likeCount: v.number(),
  })
    .index("by_postId", ["postId"])
    .index("by_authorId", ["authorId"])
    .index("by_publishedAt", ["publishedAt"])
    .searchIndex("search_searchableText", {
      searchField: "searchableText",
    }),

  /** One topic row per unique `(postId, tag)` pair for bounded Topic listings. */
  discoverPostTopics: defineTable({
    tag: v.string(),
    postId: v.id("posts"),
    publishedAt: v.number(),
  })
    .index("by_tag_and_publishedAt", ["tag", "publishedAt"])
    .index("by_postId_and_tag", ["postId", "tag"])
    .index("by_postId", ["postId"]),

  /** One non-negative published-post counter per canonical topic tag. */
  topicStats: defineTable({
    tag: v.string(),
    publishedCount: v.number(),
  }).index("by_tag", ["tag"]),

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
     * Denormalized follow counts maintained by `toggleFollow`.
     * Optional for backward compatibility with users created before follow feature was added.
     */
    followerCount: v.optional(v.number()),
    followingCount: v.optional(v.number()),
    /** Denormalized published-post count maintained by post lifecycle writes. */
    publishedPostCount: v.number(),
    /** Denormalized unread count maintained by notification mutations. */
    unreadNotificationCount: v.number(),
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
   * O(1) read. Published transitions update this value transactionally.
   */
  stats: defineTable({
    totalPosts: v.number(),
  }),

  /**
   * Short-lived claims for files uploaded for an inline image. A claim is
   * owned by the Better Auth user and is consumed when a post is published.
   */
  pendingUploads: defineTable({
    userId: v.string(),
    postId: v.optional(v.id("posts")),
    storageId: v.optional(v.id("_storage")),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_storageId", ["storageId"])
    .index("by_postId", ["postId"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  /**
   * Short-lived protection for media retained by an active authoring session.
   * These claims grant no source or post authority; they only prevent cleanup
   * while an eligible session still has a live reference.
   */
  sessionMediaClaims: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
    renewedAt: v.number(),
    expiresAt: v.number(),
    releasedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
  })
    .index("by_userId_and_sessionId", ["userId", "sessionId"])
    .index("by_userId_and_sessionId_and_storageId", [
      "userId",
      "sessionId",
      "storageId",
    ])
    .index("by_userId_and_storageId", ["userId", "storageId"])
    .index("by_storageId", ["storageId"])
    .index("by_expiresAt", ["expiresAt"]),

  /** Lease guarding the scheduled pending-upload cleanup chain. */
  pendingUploadCleanupLocks: defineTable({
    key: v.literal("pending-inline-uploads"),
    lockedUntil: v.number(),
  }).index("by_key", ["key"]),

  /**
   * Author-bound reservations for deliberate draft saves and public writes.
   * The proposal and fingerprint are immutable request identity; the outcome
   * is added by the execution boundary after a committed write or a
   * deterministic validation failure.
   */
  writeAttempts: defineTable({
    userId: v.string(),
    clientRequestId: v.string(),
    operationKind: v.union(
      v.literal("save-draft"),
      v.literal("publish"),
      v.literal("update-post"),
    ),
    postId: v.optional(v.id("posts")),
    expectedUpdatedAt: v.optional(v.number()),
    fingerprint: v.string(),
    expiresAt: v.number(),
    outcome: v.optional(
      v.union(
        v.object({
          kind: v.literal("succeeded"),
          postId: v.id("posts"),
          updatedAt: v.number(),
          status: v.union(v.literal("draft"), v.literal("published")),
        }),
        v.object({
          kind: v.literal("failed"),
          category: v.string(),
          message: v.string(),
        }),
        v.object({
          kind: v.literal("indeterminate"),
          message: v.string(),
        }),
      ),
    ),
  })
    .index("by_userId_and_clientRequestId", ["userId", "clientRequestId"])
    .index("by_expiresAt", ["expiresAt"]),

  /** Durable cursor state for bounded published-post deletion. */
  postDeletionJobs: defineTable({
    postId: v.id("posts"),
    authorId: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    likeCount: v.optional(v.number()),
    uniqueViewCount: v.optional(v.number()),
    stage: v.union(
      v.literal("comments"),
      v.literal("commentLikes"),
      v.literal("pendingUploads"),
      v.literal("likes"),
      v.literal("bookmarks"),
      v.literal("postViews"),
      v.literal("analytics"),
      v.literal("notifications"),
      v.literal("feed"),
      v.literal("done"),
    ),
    cursor: v.nullable(v.string()),
    commentCursor: v.nullable(v.string()),
    commentId: v.optional(v.id("comments")),
    commentLikeCursor: v.nullable(v.string()),
    analyticsCursor: v.optional(v.nullable(v.string())),
    analyticsLikesCount: v.optional(v.number()),
    analyticsViewsCount: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    leaseVersion: v.optional(v.number()),
  })
    .index("by_postId", ["postId"])
    .index("by_lockedUntil", ["lockedUntil"]),

  /** Durable cursor state for bounded draft upload cleanup after draft deletion. */
  draftUploadCleanupJobs: defineTable({
    postId: v.id("posts"),
    cursor: v.nullable(v.string()),
    lockedUntil: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    storageIds: v.optional(v.array(v.id("_storage"))),
    retainedStorageIds: v.optional(v.array(v.id("_storage"))),
    removeConsumed: v.optional(v.boolean()),
    leaseVersion: v.optional(v.number()),
  })
    .index("by_postId", ["postId"])
    .index("by_lockedUntil", ["lockedUntil"]),
});
