/**
 * Unit tests for Convex comment queries and mutations.
 * Covers auth rejection, body validation, denormalized commentCount increment,
 * pagination shape, and explicit createdAt timestamps.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register } from "@convex-dev/better-auth/test";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import { getDiscoverPostBySourceId } from "./discoverProjection";
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
          name: "Commenter",
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

describe("comments functions", () => {
  it("returns empty page when post has no comments", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "No comments",
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

    const result = await t.query(api.comments.getCommentsByPostId, {
      postId,
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });

  it("hides comments for a draft post", async () => {
    const t = convexTest(schema, modules);
    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Draft",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("comments", {
        postId: id,
        authorId: "user-2",
        authorName: "Alice",
        body: "Hidden",
        likeCount: 0,
        createdAt: Date.now(),
      });
      return id;
    });

    const result = await t.query(api.comments.getCommentsByPostId, {
      postId,
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });

  it("returns paginated comments ordered newest-first", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "With comments",
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
      await ctx.db.insert("comments", {
        postId: id,
        authorId: "user-3",
        authorName: "Bob",
        body: "Newer",
        likeCount: 0,
        createdAt: 2000,
      });
      await ctx.db.insert("comments", {
        postId: id,
        authorId: "user-2",
        authorName: "Alice",
        body: "Older",
        likeCount: 0,
        createdAt: 1000,
      });
      return id;
    });

    const result = await t.query(api.comments.getCommentsByPostId, {
      postId,
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page).toHaveLength(2);
    expect(result.page[0].body).toBe("Newer");
    expect(result.page[1].body).toBe("Older");
    expect(result.isDone).toBe(true);
  });

  it.each([0, 21, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid comments page size of %s",
    async (numItems) => {
      const t = convexTest(schema, modules);

      const postId = await t.run(async (ctx) => {
        return await ctx.db.insert("posts", {
          title: "Pagination target",
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

      await expect(
        t.query(api.comments.getCommentsByPostId, {
          postId,
          paginationOpts: { numItems, cursor: null },
        }),
      ).rejects.toThrow("Page size must be a safe integer between 1 and 20.");
    },
  );

  it("rejects comments pagination scans above the server cap", async () => {
    const t = convexTest(schema, modules);
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Pagination target",
        body: "Body.",
        tags: [],
        authorId: "user-1",
        status: "published",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await expect(
      t.query(api.comments.getCommentsByPostId, {
        postId,
        paginationOpts: { numItems: 20, maximumRowsRead: 21, cursor: null },
      }),
    ).rejects.toThrow("rows");
  });

  it("respects pagination limit", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Many comments",
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
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("comments", {
          postId: id,
          authorId: `user-${i}`,
          authorName: `User ${i}`,
          likeCount: 0,
          body: `Comment ${i}`,
          createdAt: 1000 + i,
        });
      }
      return id;
    });

    const result = await t.query(api.comments.getCommentsByPostId, {
      postId,
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(result.page).toHaveLength(2);
    expect(result.isDone).toBe(false);
    expect(result.continueCursor).toBeDefined();
  });

  it("rejects createComment when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "Target post",
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

    await expect(
      t.mutation(api.comments.createComment, {
        body: "A valid comment body.",
        postId,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("updates a projected post's comment count for an authenticated commenter", async () => {
    const t = convexTest(schema, modules);
    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Projected comment target",
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
        title: "Projected comment target",
        bodyText: "Body.",
        searchableText: "Projected comment target\nBody.\nAuthor",
        authorId: "author-1",
        authorName: "Author",
        tags: [],
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
      });
      return postId;
    });
    const identity = await createAuthenticatedTestUser(
      t,
      "commenter@example.com",
    );

    await expect(
      t.withIdentity(identity).mutation(api.comments.createComment, {
        body: "A valid comment body.",
        postId,
      }),
    ).resolves.toBeDefined();

    await expect(
      t.run(async (ctx) => getDiscoverPostBySourceId(ctx, postId)),
    ).resolves.toMatchObject({ commentCount: 1, likeCount: 0 });
  });

  it.each([NaN, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects createComment with a corrupted source counter of %s before writes",
    async (commentCount) => {
      const t = convexTest(schema, modules);
      const identity = await createAuthenticatedTestUser(
        t,
        `corrupted-comment-count-${String(commentCount)}@example.com`,
      );
      const postId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Corrupted comment count target",
          body: "Body.",
          tags: [],
          authorId: "author-1",
          status: "published",
          publishedAt: 1,
          commentCount,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("discoverPosts", {
          postId,
          title: "Corrupted comment count target",
          bodyText: "Body.",
          searchableText: "Corrupted comment count target\nBody.\nAuthor",
          authorId: "author-1",
          authorName: "Author",
          tags: [],
          publishedAt: 1,
          commentCount: 0,
          likeCount: 0,
        });
        return postId;
      });

      await expect(
        t.withIdentity(identity).mutation(api.comments.createComment, {
          body: "A valid comment body.",
          postId,
        }),
      ).rejects.toThrow("Comment count is corrupted.");

      const state = await t.run(async (ctx) => {
        return {
          comments: await ctx.db
            .query("comments")
            .withIndex("by_postId_and_createdAt", (q) => q.eq("postId", postId))
            .take(1),
          post: await ctx.db.get(postId),
          projection: await getDiscoverPostBySourceId(ctx, postId),
        };
      });
      expect(state.comments).toEqual([]);
      expect(state.post?.commentCount).toBe(commentCount);
      expect(state.projection?.commentCount).toBe(0);
    },
  );

  it("rejects createComment when incrementing would exceed the safe integer limit", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "max-comment-count@example.com",
    );
    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Maximum comment count target",
        body: "Body.",
        tags: [],
        authorId: "author-1",
        status: "published",
        publishedAt: 1,
        commentCount: Number.MAX_SAFE_INTEGER,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("discoverPosts", {
        postId,
        title: "Maximum comment count target",
        bodyText: "Body.",
        searchableText: "Maximum comment count target\nBody.\nAuthor",
        authorId: "author-1",
        authorName: "Author",
        tags: [],
        publishedAt: 1,
        commentCount: Number.MAX_SAFE_INTEGER,
        likeCount: 0,
      });
      return postId;
    });

    await expect(
      t.withIdentity(identity).mutation(api.comments.createComment, {
        body: "A valid comment body.",
        postId,
      }),
    ).rejects.toThrow("Comment count cannot exceed Number.MAX_SAFE_INTEGER.");

    const state = await t.run(async (ctx) => {
      return {
        comments: await ctx.db
          .query("comments")
          .withIndex("by_postId_and_createdAt", (q) => q.eq("postId", postId))
          .take(1),
        post: await ctx.db.get(postId),
        projection: await getDiscoverPostBySourceId(ctx, postId),
      };
    });
    expect(state.comments).toEqual([]);
    expect(state.post?.commentCount).toBe(Number.MAX_SAFE_INTEGER);
    expect(state.projection?.commentCount).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("includes authorAvatarUrl from users table in comment results", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Avatar test",
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
      await ctx.db.insert("users", {
        userId: "user-2",
        displayName: "Alice",
        email: "alice@example.com",
        avatarUrl: "https://example.com/alice.png",
        bio: "",
        followerCount: 0,
        followingCount: 0,
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: Date.now(),
      });
      await ctx.db.insert("comments", {
        postId: id,
        authorId: "user-2",
        authorName: "Alice",
        body: "Great post!",
        likeCount: 0,
        createdAt: 1000,
      });
      return id;
    });

    const result = await t.query(api.comments.getCommentsByPostId, {
      postId,
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].authorAvatarUrl).toBe(
      "https://example.com/alice.png",
    );
  });

  it("returns null authorAvatarUrl when user has no users record", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "No user record",
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
      await ctx.db.insert("comments", {
        postId: id,
        authorId: "unknown-user",
        authorName: "Ghost",
        body: "Orphan comment",
        likeCount: 0,
        createdAt: 1000,
      });
      return id;
    });

    const result = await t.query(api.comments.getCommentsByPostId, {
      postId,
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].authorAvatarUrl).toBeNull();
  });

  it("getCommentsByPostId returns isLiked false and the stored likeCount", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Like default",
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
      await ctx.db.insert("comments", {
        postId: id,
        authorId: "user-2",
        authorName: "Alice",
        body: "Old comment without likeCount field.",
        likeCount: 0,
        createdAt: 1000,
      });
      return id;
    });

    const result = await t.query(api.comments.getCommentsByPostId, {
      postId,
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].isLiked).toBe(false);
    expect(result.page[0].likeCount).toBe(0);
  });

  it("getCommentsByPostId surfaces stored denormalized likeCount for unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Stored count",
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
      await ctx.db.insert("comments", {
        postId: id,
        authorId: "user-2",
        authorName: "Alice",
        body: "Liked comment.",
        likeCount: 3,
        createdAt: 1000,
      });
      return id;
    });

    const result = await t.query(api.comments.getCommentsByPostId, {
      postId,
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].likeCount).toBe(3);
    expect(result.page[0].isLiked).toBe(false);
  });
});
