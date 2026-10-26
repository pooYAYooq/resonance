/**
 * Unit tests for Convex likes queries and mutations.
 * Covers auth rejection and unauthenticated isLiked behavior.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register } from "@convex-dev/better-auth/test";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import { getDiscoverPostBySourceId } from "./discoverProjection";
import * as likes from "./likes";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createAuthenticatedTestUser(
  t: ReturnType<typeof convexTest>,
  email: string,
) {
  register(t);
  return await t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Viewer",
          email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            userId: user._id,
            token: `session-${email}`,
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
}

describe("likes functions", () => {
  it("getLikedPosts returns an empty completed page when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.likes.getLikedPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result).toEqual({ page: [], isDone: true, continueCursor: "" });
  });

  it.each([0, 21, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid liked posts page size of %s",
    async (numItems) => {
      const t = convexTest(schema, modules);

      await expect(
        t.query(api.likes.getLikedPosts, {
          paginationOpts: { numItems, cursor: null },
        }),
      ).rejects.toThrow("Page size must be a safe integer between 1 and 20.");
    },
  );

  it("rejects liked-post pagination scans above the server cap", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.likes.getLikedPosts, {
        paginationOpts: { numItems: 20, maximumRowsRead: 21, cursor: null },
      }),
    ).rejects.toThrow("rows");
  });

  it("returns one viewer's published likes newest first", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const olderPostId = await ctx.db.insert("posts", {
        title: "Older liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
      const newerPostId = await ctx.db.insert("posts", {
        title: "Newer liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("likes", {
        postId: olderPostId,
        userId: "viewer-1",
        createdAt: 100,
      });
      await ctx.db.insert("likes", {
        postId: newerPostId,
        userId: "viewer-1",
        createdAt: 200,
      });
    });

    const result = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 10, cursor: null },
        viewerId: "viewer-1",
      }),
    );

    expect(result.page.map((post) => post.title)).toEqual([
      "Newer liked post",
      "Older liked post",
    ]);
    expect(result.page.map((post) => post.addedAt)).toEqual([200, 100]);
  });

  it("preserves the source cursor when the newest like points to a draft", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const publishedPostId = await ctx.db.insert("posts", {
        title: "Older published liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const draftPostId = await ctx.db.insert("posts", {
        title: "Newest draft liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
      await ctx.db.insert("likes", {
        postId: publishedPostId,
        userId: "viewer-1",
        createdAt: 100,
      });
      await ctx.db.insert("likes", {
        postId: draftPostId,
        userId: "viewer-1",
        createdAt: 200,
      });
    });

    const firstPage = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 1, cursor: null },
        viewerId: "viewer-1",
      }),
    );

    expect(firstPage.page).toEqual([]);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.continueCursor).not.toBe("");

    const secondPage = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 1, cursor: firstPage.continueCursor },
        viewerId: "viewer-1",
      }),
    );

    expect(secondPage.page.map((post) => post.title)).toEqual([
      "Older published liked post",
    ]);
    expect(secondPage.isDone).toBe(true);
  });

  it("skips draft and missing liked posts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const publishedPostId = await ctx.db.insert("posts", {
        title: "Published liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const draftPostId = await ctx.db.insert("posts", {
        title: "Draft liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "draft",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
      const deletedPostId = await ctx.db.insert("posts", {
        title: "Deleted liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 3,
        updatedAt: 3,
      });
      await ctx.db.delete(deletedPostId);
      await ctx.db.insert("likes", {
        postId: publishedPostId,
        userId: "viewer-1",
        createdAt: 100,
      });
      await ctx.db.insert("likes", {
        postId: draftPostId,
        userId: "viewer-1",
        createdAt: 200,
      });
      await ctx.db.insert("likes", {
        postId: deletedPostId,
        userId: "viewer-1",
        createdAt: 300,
      });
    });

    const result = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 10, cursor: null },
        viewerId: "viewer-1",
      }),
    );

    expect(result.page.map((post) => post.title)).toEqual([
      "Published liked post",
    ]);
  });

  it("never returns another viewer's likes", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const firstPostId = await ctx.db.insert("posts", {
        title: "First viewer's liked post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const secondPostId = await ctx.db.insert("posts", {
        title: "Second viewer's liked post",
        body: "Body.",
        tags: [],
        authorId: "author-2",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 2,
        updatedAt: 2,
      });
      await ctx.db.insert("likes", {
        postId: firstPostId,
        userId: "viewer-1",
        createdAt: 100,
      });
      await ctx.db.insert("likes", {
        postId: secondPostId,
        userId: "viewer-2",
        createdAt: 200,
      });
    });

    const result = await t.run((ctx) =>
      likes.getLikedPostsForUser(ctx, {
        paginationOpts: { numItems: 10, cursor: null },
        viewerId: "viewer-1",
      }),
    );

    expect(result.page.map((post) => post.title)).toEqual([
      "First viewer's liked post",
    ]);
  });

  it("rejects toggleLike when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "Like target",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(t.mutation(api.likes.toggleLike, { postId })).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("updates a projected post's like count for an authenticated viewer", async () => {
    const t = convexTest(schema, modules);
    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Projected like target",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("discoverPosts", {
        postId,
        title: "Projected like target",
        bodyText: "Body.",
        authorId: "author-1",
        authorName: "Author",
        tags: [],
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
      });
      return postId;
    });
    const identity = await createAuthenticatedTestUser(t, "viewer@example.com");

    await expect(
      t.withIdentity(identity).mutation(api.likes.toggleLike, {
        postId,
      }),
    ).resolves.toEqual({ liked: true, likeCount: 1 });

    await expect(
      t.run(async (ctx) => getDiscoverPostBySourceId(ctx, postId)),
    ).resolves.toMatchObject({ likeCount: 1, commentCount: 0 });
  });

  it("decrements a projected post's like count when an authenticated viewer removes a like", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "removing-viewer@example.com",
    );
    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Projected unlike target",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("discoverPosts", {
        postId,
        title: "Projected unlike target",
        bodyText: "Body.",
        authorId: "author-1",
        authorName: "Author",
        tags: [],
        publishedAt: 1,
        commentCount: 0,
        likeCount: 1,
      });
      await ctx.db.insert("likes", {
        postId,
        userId: identity.subject,
        createdAt: 1,
      });
      return postId;
    });

    await expect(
      t.withIdentity(identity).mutation(api.likes.toggleLike, { postId }),
    ).resolves.toEqual({ liked: false, likeCount: 0 });

    await expect(
      t.run(async (ctx) => getDiscoverPostBySourceId(ctx, postId)),
    ).resolves.toMatchObject({ likeCount: 0, commentCount: 0 });
  });

  it("keeps an absent engagement projection absent after an authenticated like", async () => {
    const t = convexTest(schema, modules);
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Unprojected like target",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const identity = await createAuthenticatedTestUser(
      t,
      "unprojected-viewer@example.com",
    );

    await expect(
      t.withIdentity(identity).mutation(api.likes.toggleLike, {
        postId,
      }),
    ).resolves.toEqual({ liked: true, likeCount: 1 });

    await expect(
      t.run(async (ctx) => getDiscoverPostBySourceId(ctx, postId)),
    ).resolves.toBeNull();
  });

  it.each([NaN, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects toggleLike with a corrupted source counter of %s",
    async (likeCount) => {
      const t = convexTest(schema, modules);
      const identity = await createAuthenticatedTestUser(
        t,
        `corrupted-post-count-${String(likeCount)}@example.com`,
      );
      const postId = await t.run(async (ctx) => {
        return await ctx.db.insert("posts", {
          title: "Corrupted post counter",
          body: "Body.",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount,
          uniqueViewCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.withIdentity(identity).mutation(api.likes.toggleLike, { postId }),
      ).rejects.toThrow("Like count is corrupted.");
    },
  );

  it("rejects toggleLike when removing a like from a zero counter", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "zero-post-count@example.com",
    );
    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Zero post counter",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("likes", {
        postId: id,
        userId: identity.subject,
        createdAt: Date.now(),
      });
      return id;
    });

    await expect(
      t.withIdentity(identity).mutation(api.likes.toggleLike, { postId }),
    ).rejects.toThrow("Like count cannot be decremented below zero.");

    await expect(
      t.run(async (ctx) => {
        return await ctx.db
          .query("likes")
          .withIndex("by_postId_and_userId", (q) =>
            q.eq("postId", postId).eq("userId", identity.subject),
          )
          .unique();
      }),
    ).resolves.not.toBeNull();
  });

  it("rejects toggleLike when adding one would exceed the safe integer limit", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "max-post-count@example.com",
    );
    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "Maximum post counter",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: Number.MAX_SAFE_INTEGER,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(identity).mutation(api.likes.toggleLike, { postId }),
    ).rejects.toThrow("Like count cannot exceed Number.MAX_SAFE_INTEGER.");
  });

  it("rejects toggleCommentLike when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const { commentId } = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Post",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const id = await ctx.db.insert("comments", {
        postId,
        authorId: "user-2",
        authorName: "Alice",
        body: "Nice post.",
        likeCount: 0,
        createdAt: Date.now(),
      });
      return { commentId: id };
    });

    await expect(
      t.mutation(api.likes.toggleCommentLike, { commentId }),
    ).rejects.toThrow("Unauthorized");
  });

  it.each([NaN, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects toggleCommentLike with a corrupted source counter of %s",
    async (likeCount) => {
      const t = convexTest(schema, modules);
      const identity = await createAuthenticatedTestUser(
        t,
        `corrupted-comment-count-${String(likeCount)}@example.com`,
      );
      const commentId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Corrupted comment counter post",
          body: "Body.",
          tags: [],
          authorId: "author-1",
          status: "published",
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return await ctx.db.insert("comments", {
          postId,
          authorId: "author-2",
          authorName: "Commenter",
          body: "Comment with corrupted counter.",
          likeCount,
          createdAt: Date.now(),
        });
      });

      await expect(
        t.withIdentity(identity).mutation(api.likes.toggleCommentLike, {
          commentId,
        }),
      ).rejects.toThrow("Like count is corrupted.");
    },
  );

  it("rejects toggleCommentLike when removing a like from a zero counter", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "zero-comment-count@example.com",
    );
    const commentId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Zero comment counter post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const id = await ctx.db.insert("comments", {
        postId,
        authorId: "author-2",
        authorName: "Commenter",
        body: "Comment with zero counter.",
        likeCount: 0,
        createdAt: Date.now(),
      });
      await ctx.db.insert("commentLikes", {
        commentId: id,
        userId: identity.subject,
        createdAt: Date.now(),
      });
      return id;
    });

    await expect(
      t.withIdentity(identity).mutation(api.likes.toggleCommentLike, {
        commentId,
      }),
    ).rejects.toThrow("Like count cannot be decremented below zero.");

    await expect(
      t.run(async (ctx) => {
        return await ctx.db
          .query("commentLikes")
          .withIndex("by_commentId_and_userId", (q) =>
            q.eq("commentId", commentId).eq("userId", identity.subject),
          )
          .unique();
      }),
    ).resolves.not.toBeNull();
  });

  it("rejects toggleCommentLike when adding one would exceed the safe integer limit", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "max-comment-count@example.com",
    );
    const commentId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Maximum comment counter post",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return await ctx.db.insert("comments", {
        postId,
        authorId: "author-2",
        authorName: "Commenter",
        body: "Comment with maximum counter.",
        likeCount: Number.MAX_SAFE_INTEGER,
        createdAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(identity).mutation(api.likes.toggleCommentLike, {
        commentId,
      }),
    ).rejects.toThrow("Like count cannot exceed Number.MAX_SAFE_INTEGER.");
  });

  it("getPostById returns isLiked: false for unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Liked post",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("likes", {
        postId: id,
        userId: "user-1",
        createdAt: Date.now(),
      });
      return id;
    });

    const result = await t.query(api.posts.getPostById, { postId });
    expect(result).not.toBeNull();
    expect(result?.isLiked).toBe(false);
  });

  it("getPosts returns isLiked: false for unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Liked post",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("likes", {
        postId: id,
        userId: "user-1",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page.length).toBeGreaterThan(0);
    for (const post of result.page) {
      expect(post.isLiked).toBe(false);
    }
  });

  it("getPostsByAuthorId returns isLiked: false for unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Liked post",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("likes", {
        postId: id,
        userId: "user-1",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "user-1",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page.length).toBeGreaterThan(0);
    for (const post of result.page) {
      expect(post.isLiked).toBe(false);
    }
  });

  it("notifies the post author once when someone likes their post", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "liker@example.com");
    const postId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "author-1",
        displayName: "Author",
        publishedPostCount: 1,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      return await ctx.db.insert("posts", {
        title: "Target",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await t.withIdentity(identity).mutation(api.likes.toggleLike, { postId });
    const first = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(first).toHaveLength(1);

    await t.run((ctx) => ctx.db.patch(first[0]._id, { readAt: 5 }));
    await t.withIdentity(identity).mutation(api.likes.toggleLike, { postId });
    await t.withIdentity(identity).mutation(api.likes.toggleLike, { postId });

    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipientId: "author-1",
      actorId: identity.subject,
      type: "post_like",
      postId,
      createdAt: first[0].createdAt,
      readAt: 5,
    });
  });

  it("does not notify an author who likes their own post", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(t, "self@example.com");
    const postId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Self",
        publishedPostCount: 1,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      return await ctx.db.insert("posts", {
        title: "Own",
        body: "Body.",
        tags: [],
        authorId: identity.subject,
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await t.withIdentity(identity).mutation(api.likes.toggleLike, { postId });

    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect()),
    ).toHaveLength(0);
    const author = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique(),
    );
    expect(author?.unreadNotificationCount).toBe(0);
  });

  it("notifies the comment author rather than the post author when a comment is liked", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "comment-liker@example.com",
    );
    const commentId = await t.run(async (ctx) => {
      for (const userId of ["post-author", "comment-author"]) {
        await ctx.db.insert("users", {
          userId,
          displayName: userId,
          publishedPostCount: 0,
          unreadNotificationCount: 0,
          createdAt: 1,
        });
      }
      const postId = await ctx.db.insert("posts", {
        title: "Target",
        body: "Body.",
        tags: [],
        authorId: "post-author",
        status: "published",
        commentCount: 1,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("comments", {
        postId,
        authorId: "comment-author",
        authorName: "Commenter",
        body: "A comment",
        likeCount: 0,
        createdAt: 1,
      });
    });

    await t
      .withIdentity(identity)
      .mutation(api.likes.toggleCommentLike, { commentId });
    const first = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(first).toHaveLength(1);
    await t.run((ctx) => ctx.db.patch(first[0]._id, { readAt: 5 }));

    await t
      .withIdentity(identity)
      .mutation(api.likes.toggleCommentLike, { commentId });
    await t
      .withIdentity(identity)
      .mutation(api.likes.toggleCommentLike, { commentId });

    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipientId: "comment-author",
      actorId: identity.subject,
      type: "comment_like",
      commentId,
      createdAt: first[0].createdAt,
      readAt: 5,
    });
  });

  it("does not notify a comment author who likes their own comment", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "self-comment@example.com",
    );
    const commentId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: identity.subject,
        displayName: "Self",
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      const postId = await ctx.db.insert("posts", {
        title: "Target",
        body: "Body.",
        tags: [],
        authorId: "someone-else",
        status: "published",
        commentCount: 1,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("comments", {
        postId,
        authorId: identity.subject,
        authorName: "Self",
        body: "Own comment",
        likeCount: 0,
        createdAt: 1,
      });
    });

    await t
      .withIdentity(identity)
      .mutation(api.likes.toggleCommentLike, { commentId });

    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect()),
    ).toHaveLength(0);
    const author = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique(),
    );
    expect(author?.unreadNotificationCount).toBe(0);
  });
});
