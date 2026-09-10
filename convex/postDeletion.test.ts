/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register } from "@convex-dev/better-auth/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// The Better Auth convex-test adapter cannot reliably isolate two sessions in
// one database; production ownership remains checked against the resolved user.

afterEach(() => {
  vi.useRealTimers();
});

async function createAuthenticatedTestUser(
  t: ReturnType<typeof convexTest>,
  email: string,
) {
  register(t);
  const identity = await t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Post owner",
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
  const appUserId = await t
    .withIdentity(identity)
    .mutation(api.users.syncUser, {});
  await t.run(async (ctx) => {
    await ctx.db.patch(appUserId, { publishedPostCount: 1 });
  });
  return identity;
}

describe("published post deletion", () => {
  it("rejects anonymous deletion without removing the published source", async () => {
    const t = convexTest(schema, modules);
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        title: "Published post",
        body: "Body",
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

    await expect(
      t.mutation(api.posts.deletePublishedPost, { postId }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      t.run(async (ctx) => ctx.db.get(postId)),
    ).resolves.toMatchObject({ status: "published" });
  });

  it("hides the source and projection immediately, then drains dependent rows", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(t, "owner@example.com");
    const ids = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Delete me",
        body: "Body",
        tags: ["Technology"],
        authorId: identity.subject,
        status: "published",
        publishedAt: 1,
        commentCount: 1,
        likeCount: 1,
        uniqueViewCount: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("discoverPosts", {
        postId,
        title: "Delete me",
        bodyText: "Body",
        authorId: identity.subject,
        authorName: "Post owner",
        tags: ["Technology"],
        publishedAt: 1,
        commentCount: 1,
        likeCount: 1,
      });
      await ctx.db.insert("discoverPostSearch", {
        postId,
        title: "Delete me",
        authorId: identity.subject,
        authorName: "Post owner",
        searchableText: "Delete me\nBody\nPost owner",
      });
      await ctx.db.insert("discoverPostTopics", {
        postId,
        tag: "Technology",
        publishedAt: 1,
      });
      const topicStat = await ctx.db.insert("topicStats", {
        tag: "Technology",
        publishedCount: 1,
      });
      const commentId = await ctx.db.insert("comments", {
        postId,
        authorId: "commenter",
        authorName: "Commenter",
        body: "Comment",
        likeCount: 1,
        createdAt: 1,
      });
      await ctx.db.insert("commentLikes", {
        commentId,
        userId: "commenter",
        createdAt: 1,
      });
      await ctx.db.insert("likes", { postId, userId: "liker", createdAt: 1 });
      await ctx.db.insert("authorAnalytics", {
        authorId: identity.subject,
        likesReceived: 1,
        uniqueViews: 1,
      });
      await ctx.db.insert("bookmarks", {
        postId,
        userId: "bookmarker",
        createdAt: 1,
      });
      await ctx.db.insert("postViews", {
        postId,
        viewerKey: "viewer",
        createdAt: 1,
      });
      await ctx.db.insert("users", {
        userId: "recipient",
        displayName: "Recipient",
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      await ctx.db.insert("notifications", {
        postId,
        recipientId: "recipient",
        actorId: identity.subject,
        createdAt: 1,
        readAt: 2,
      });
      await ctx.db.insert("feed", {
        postId,
        userId: "recipient",
        authorId: identity.subject,
        followId: await ctx.db.insert("follows", {
          followerId: "recipient",
          followingId: identity.subject,
          createdAt: 1,
        }),
        createdAt: 1,
        insertedAt: 1,
      });
      await ctx.db.insert("stats", { totalPosts: 1 });
      return { postId, topicStat };
    });

    await expect(
      t
        .withIdentity(identity)
        .mutation(api.posts.deletePublishedPost, { postId: ids.postId }),
    ).resolves.toEqual({ started: true });
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.postId)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) =>
        ctx.db
          .query("discoverPosts")
          .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
          .take(1),
      ),
    ).resolves.toEqual([]);
    await expect(
      t.run(async (ctx) =>
        ctx.db
          .query("discoverPostTopics")
          .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
          .take(1),
      ),
    ).resolves.toEqual([]);
    await expect(
      t.run(async (ctx) =>
        ctx.db
          .query("discoverPostSearch")
          .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
          .take(1),
      ),
    ).resolves.toEqual([]);
    await expect(
      t.run(async (ctx) => ctx.db.query("stats").first()),
    ).resolves.toMatchObject({ totalPosts: 0 });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const state = await t.run(async (ctx) => ({
      comments: await ctx.db
        .query("comments")
        .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
        .take(2),
      commentLikes: await ctx.db.query("commentLikes").take(2),
      likes: await ctx.db
        .query("likes")
        .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
        .take(2),
      bookmarks: await ctx.db
        .query("bookmarks")
        .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
        .take(2),
      notifications: await ctx.db
        .query("notifications")
        .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
        .take(2),
      feed: await ctx.db
        .query("feed")
        .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
        .take(2),
      stat: await ctx.db.get(ids.topicStat),
      stats: await ctx.db.query("stats").first(),
      jobs: await ctx.db
        .query("postDeletionJobs")
        .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
        .take(2),
      recipient: await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", "recipient"))
        .unique(),
    }));
    expect(state.comments).toEqual([]);
    expect(state.commentLikes).toEqual([]);
    expect(state.likes).toEqual([]);
    expect(state.bookmarks).toEqual([]);
    expect(state.notifications).toEqual([]);
    expect(state.feed).toEqual([]);
    expect(state.stat?.publishedCount).toBe(0);
    expect(state.stats?.totalPosts).toBe(0);
    expect(state.jobs).toEqual([]);
    expect(state.recipient?.unreadNotificationCount).toBe(0);

    await expect(
      t
        .withIdentity(identity)
        .mutation(api.posts.deletePublishedPost, { postId: ids.postId }),
    ).rejects.toThrow("Post not found.");
  });

  it("schedules after deleting a full dependent batch", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Large delete",
        body: "Body",
        tags: [],
        authorId: "owner",
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 100,
        createdAt: 1,
        updatedAt: 1,
      });
      for (let i = 0; i < 101; i++) {
        await ctx.db.insert("likes", {
          postId,
          userId: `user-${i}`,
          createdAt: i,
        });
      }
      const jobId = await ctx.db.insert("postDeletionJobs", {
        postId,
        authorId: "owner",
        stage: "likes",
        cursor: null,
        commentCursor: null,
        commentLikeCursor: null,
        leaseVersion: 1,
      });
      await ctx.db.insert("authorAnalytics", {
        authorId: "owner",
        likesReceived: 101,
        uniqueViews: 0,
      });
      return { postId, jobId };
    });

    await t.mutation(internal.postDeletion.continuePublishedPostDeletion, {
      jobId: postId.jobId,
      leaseVersion: 1,
    });
    const job = await t.run(async (ctx) => ctx.db.get(postId.jobId));
    expect(job?.stage).toBe("likes");
    expect(job?.cursor).not.toBeNull();
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("likes")
          .withIndex("by_postId", (q) => q.eq("postId", postId.postId))
          .take(101),
      ),
    ).toHaveLength(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  it("reclaims the cover and every upload claim, including consumed claims", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(
      t,
      "uploads@example.com",
    );
    const ids = await t.run(async (ctx) => {
      const cover = await ctx.storage.store(new Blob(["cover"]));
      const inline = await ctx.storage.store(new Blob(["inline"]));
      const postId = await ctx.db.insert("posts", {
        title: "Upload cleanup",
        body: "Body",
        tags: [],
        authorId: identity.subject,
        imageStorageId: cover,
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const pending = await ctx.db.insert("pendingUploads", {
        userId: identity.subject,
        postId,
        storageId: inline,
        consumedAt: Number.MAX_SAFE_INTEGER,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      return { postId, cover, inline, pending };
    });

    await t.withIdentity(identity).mutation(api.posts.deletePublishedPost, {
      postId: ids.postId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(
      t.run(async (ctx) => ctx.db.get(ids.pending)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.cover)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.inline)),
    ).resolves.toBeNull();
  });

  it("decrements author analytics exactly once for deleted likes and views", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(
      t,
      "analytics-delete@example.com",
    );
    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Analytics cleanup",
        body: "Body",
        tags: [],
        authorId: identity.subject,
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 2,
        uniqueViewCount: 2,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("authorAnalytics", {
        authorId: identity.subject,
        likesReceived: 2,
        uniqueViews: 2,
      });
      for (const userId of ["like-1", "like-2"])
        await ctx.db.insert("likes", { postId, userId, createdAt: 1 });
      for (const viewerKey of ["view-1", "view-2"])
        await ctx.db.insert("postViews", { postId, viewerKey, createdAt: 1 });
      await ctx.db.insert("stats", { totalPosts: 1 });
      return postId;
    });

    await t
      .withIdentity(identity)
      .mutation(api.posts.deletePublishedPost, { postId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(
      t.run(async (ctx) =>
        ctx.db
          .query("authorAnalytics")
          .withIndex("by_authorId", (q) => q.eq("authorId", identity.subject))
          .unique(),
      ),
    ).resolves.toMatchObject({ likesReceived: 0, uniqueViews: 0 });
  });

  it("repairs zero analytics and drains likes", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(
      t,
      "invalid-analytics@example.com",
    );
    const ids = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Invalid analytics",
        body: "Body",
        tags: [],
        authorId: identity.subject,
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("authorAnalytics", {
        authorId: identity.subject,
        likesReceived: 0,
        uniqueViews: 0,
      });
      const likeId = await ctx.db.insert("likes", {
        postId,
        userId: "liker",
        createdAt: 1,
      });
      await ctx.db.insert("stats", { totalPosts: 1 });
      return { postId, likeId };
    });

    await t
      .withIdentity(identity)
      .mutation(api.posts.deletePublishedPost, { postId: ids.postId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.likeId)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) =>
        ctx.db
          .query("authorAnalytics")
          .withIndex("by_authorId", (q) => q.eq("authorId", identity.subject))
          .unique(),
      ),
    ).resolves.toMatchObject({ likesReceived: 0 });
  });

  it("does not overwrite analytics with only the first 100 surviving posts", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(
      t,
      "bounded-analytics@example.com",
    );
    const ids = await t.run(async (ctx) => {
      const targetPostId = await ctx.db.insert("posts", {
        title: "Target",
        body: "Body",
        tags: [],
        authorId: identity.subject,
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("posts", {
          title: `Survivor ${index}`,
          body: "Body",
          tags: [],
          authorId: identity.subject,
          status: "published",
          publishedAt: index + 2,
          commentCount: 0,
          likeCount: 1,
          uniqueViewCount: 0,
          createdAt: index + 2,
          updatedAt: index + 2,
        });
      }
      await ctx.db.insert("authorAnalytics", {
        authorId: identity.subject,
        likesReceived: 102,
        uniqueViews: 0,
      });
      const jobId = await ctx.db.insert("postDeletionJobs", {
        postId: targetPostId,
        authorId: identity.subject,
        stage: "likes",
        cursor: null,
        commentCursor: null,
        commentLikeCursor: null,
        leaseVersion: 1,
      });
      return { jobId };
    });

    await t.mutation(internal.postDeletion.continuePublishedPostDeletion, {
      jobId: ids.jobId,
      leaseVersion: 1,
    });

    await expect(
      t.run(async (ctx) =>
        ctx.db
          .query("authorAnalytics")
          .withIndex("by_authorId", (q) => q.eq("authorId", identity.subject))
          .unique(),
      ),
    ).resolves.toMatchObject({ likesReceived: 102, uniqueViews: 0 });
  });

  it.each([
    ["missing", undefined],
    ["invalid", Number.NaN],
  ] as const)(
    "repairs %s analytics while preserving unrelated counters",
    async (_kind, likesReceived) => {
      const t = convexTest(schema, modules);
      vi.useFakeTimers();
      const identity = await createAuthenticatedTestUser(
        t,
        `${_kind}-repair@example.com`,
      );
      const ids = await t.run(async (ctx) => {
        const otherPostId = await ctx.db.insert("posts", {
          title: "Other",
          body: "Body",
          tags: [],
          authorId: identity.subject,
          status: "published",
          publishedAt: 1,
          commentCount: 0,
          likeCount: 1,
          uniqueViewCount: 1,
          createdAt: 1,
          updatedAt: 1,
        });
        const postId = await ctx.db.insert("posts", {
          title: "Target",
          body: "Body",
          tags: [],
          authorId: identity.subject,
          status: "published",
          publishedAt: 2,
          commentCount: 0,
          likeCount: 1,
          uniqueViewCount: 1,
          createdAt: 2,
          updatedAt: 2,
        });
        await ctx.db.insert("likes", {
          postId,
          userId: "target-like",
          createdAt: 1,
        });
        await ctx.db.insert("postViews", {
          postId,
          viewerKey: "target-view",
          createdAt: 1,
        });
        await ctx.db.insert("likes", {
          postId: otherPostId,
          userId: "other-like",
          createdAt: 1,
        });
        await ctx.db.insert("postViews", {
          postId: otherPostId,
          viewerKey: "other-view",
          createdAt: 1,
        });
        if (likesReceived !== undefined) {
          await ctx.db.insert("authorAnalytics", {
            authorId: identity.subject,
            likesReceived,
            uniqueViews: Number.NaN,
          });
        }
        const jobId = await ctx.db.insert("postDeletionJobs", {
          postId,
          authorId: identity.subject,
          stage: "likes",
          cursor: null,
          commentCursor: null,
          commentLikeCursor: null,
          leaseVersion: 1,
        });
        return { postId, jobId };
      });

      await t.mutation(internal.postDeletion.continuePublishedPostDeletion, {
        jobId: ids.jobId,
        leaseVersion: 1,
      });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      await expect(
        t.run(async (ctx) =>
          ctx.db
            .query("authorAnalytics")
            .withIndex("by_authorId", (q) => q.eq("authorId", identity.subject))
            .unique(),
        ),
      ).resolves.toMatchObject({ likesReceived: 1, uniqueViews: 1 });
    },
  );

  it("deletes views when the analytics row is missing", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(
      t,
      "missing-view-analytics@example.com",
    );
    const ids = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Missing view analytics",
        body: "Body",
        tags: [],
        authorId: identity.subject,
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      const viewId = await ctx.db.insert("postViews", {
        postId,
        viewerKey: "viewer",
        createdAt: 1,
      });
      await ctx.db.insert("stats", { totalPosts: 1 });
      return { postId, viewId };
    });

    await t
      .withIdentity(identity)
      .mutation(api.posts.deletePublishedPost, { postId: ids.postId });
    await expect(
      t.finishAllScheduledFunctions(vi.runAllTimers),
    ).resolves.toBeUndefined();
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.viewId)),
    ).resolves.toBeNull();
  });

  it("does not decrement unread notifications below zero after mark-all-read", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const ids = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Read notification",
        body: "Body",
        tags: [],
        authorId: "owner",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const recipientId = await ctx.db.insert("users", {
        userId: "recipient",
        displayName: "Recipient",
        publishedPostCount: 0,
        unreadNotificationCount: 0,
        createdAt: 1,
      });
      await ctx.db.insert("notifications", {
        postId,
        recipientId: "recipient",
        actorId: "owner",
        createdAt: 1,
      });
      const jobId = await ctx.db.insert("postDeletionJobs", {
        postId,
        authorId: "owner",
        stage: "notifications",
        cursor: null,
        commentCursor: null,
        commentLikeCursor: null,
        leaseVersion: 1,
      });
      return { jobId, recipientId };
    });

    await t.mutation(internal.postDeletion.continuePublishedPostDeletion, {
      jobId: ids.jobId,
      leaseVersion: 1,
    });
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.recipientId)),
    ).resolves.toMatchObject({
      unreadNotificationCount: 0,
    });
  });

  it("ignores a stale deletion continuation after a newer lease claims the job", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Stale lease",
        body: "Body",
        tags: [],
        authorId: "owner",
        status: "draft",
        commentCount: 0,
        likeCount: 1,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const likeId = await ctx.db.insert("likes", {
        postId,
        userId: "liker",
        createdAt: 1,
      });
      const jobId = await ctx.db.insert("postDeletionJobs", {
        postId,
        authorId: "owner",
        stage: "likes",
        cursor: null,
        commentCursor: null,
        commentLikeCursor: null,
        leaseVersion: 2,
      });
      return { jobId, likeId };
    });

    await t.mutation(internal.postDeletion.continuePublishedPostDeletion, {
      jobId: ids.jobId,
      leaseVersion: 1,
    });
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.likeId)),
    ).resolves.not.toBeNull();
  });

  it("fails before deleting duplicate topic rows when their stat cannot cover them", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "duplicate-topic-stat@example.com",
    );
    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Duplicate topics",
        body: "Body",
        tags: ["Technology"],
        authorId: identity.subject,
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
        title: "Duplicate topics",
        bodyText: "Body",
        authorId: identity.subject,
        authorName: "Post owner",
        tags: ["Technology"],
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
      });
      await ctx.db.insert("discoverPostTopics", {
        postId,
        tag: "Technology",
        publishedAt: 1,
      });
      await ctx.db.insert("discoverPostTopics", {
        postId,
        tag: "Technology",
        publishedAt: 1,
      });
      await ctx.db.insert("topicStats", {
        tag: "Technology",
        publishedCount: 1,
      });
      await ctx.db.insert("stats", { totalPosts: 1 });
      return postId;
    });

    await expect(
      t
        .withIdentity(identity)
        .mutation(api.posts.deletePublishedPost, { postId }),
    ).rejects.toThrow("Topic stat");
    await expect(
      t.run(async (ctx) => ctx.db.get(postId)),
    ).resolves.toMatchObject({
      status: "published",
    });
  });

  it("restarts a stale deletion job through the internal watchdog", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const jobId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Already hidden",
        body: "Body",
        tags: [],
        authorId: "owner",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      return ctx.db.insert("postDeletionJobs", {
        postId,
        authorId: "owner",
        stage: "comments",
        cursor: null,
        commentCursor: null,
        commentLikeCursor: null,
        lockedUntil: 0,
        updatedAt: 0,
      });
    });

    await t.mutation(internal.postDeletion.recoverStaleDeletionJobs, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(t.run(async (ctx) => ctx.db.get(jobId))).resolves.toBeNull();
  });

  it("recovers a stale draft cleanup job without touching unrelated claims", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const ids = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["draft"]));
      const postId = await ctx.db.insert("posts", {
        title: "Hidden draft",
        body: "Body",
        tags: [],
        authorId: "owner",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const targetClaim = await ctx.db.insert("pendingUploads", {
        userId: "owner",
        postId,
        storageId,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      const unrelatedClaim = await ctx.db.insert("pendingUploads", {
        userId: "other-owner",
        storageId,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      const jobId = await ctx.db.insert("draftUploadCleanupJobs", {
        postId,
        cursor: null,
        lockedUntil: 0,
        updatedAt: 0,
        leaseVersion: 1,
      });
      return { storageId, targetClaim, unrelatedClaim, jobId };
    });

    await t.mutation(internal.postDeletion.recoverStaleDeletionJobs, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.targetClaim)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.unrelatedClaim)),
    ).resolves.not.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.jobId)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.storageId)),
    ).resolves.not.toBeNull();
  });

  it("fails before hiding a post when its topic stat is missing", async () => {
    const t = convexTest(schema, modules);
    const identity = await createAuthenticatedTestUser(
      t,
      "missing-stat@example.com",
    );
    const postId = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Missing stat",
        body: "Body",
        tags: ["Technology"],
        authorId: identity.subject,
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
        title: "Missing stat",
        bodyText: "Body",
        authorId: identity.subject,
        authorName: "Post owner",
        tags: ["Technology"],
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
      });
      await ctx.db.insert("discoverPostTopics", {
        postId,
        tag: "Technology",
        publishedAt: 1,
      });
      await ctx.db.insert("stats", { totalPosts: 1 });
      return postId;
    });

    await expect(
      t
        .withIdentity(identity)
        .mutation(api.posts.deletePublishedPost, { postId }),
    ).rejects.toThrow("Missing topic stat");
    await expect(
      t.run(async (ctx) => ctx.db.get(postId)),
    ).resolves.toMatchObject({
      status: "published",
    });
  });

  it("deletes a draft immediately and cleans its uploads in bounded continuations", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(
      t,
      "draft-cleanup@example.com",
    );
    const ids = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", {
        title: "Draft",
        body: "Body",
        tags: [],
        authorId: identity.subject,
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const storageIds = [];
      for (let i = 0; i < 101; i++) {
        const storageId = await ctx.storage.store(new Blob([`image-${i}`]));
        storageIds.push(storageId);
        await ctx.db.insert("pendingUploads", {
          userId: identity.subject,
          postId,
          storageId,
          createdAt: 1,
          expiresAt: Number.MAX_SAFE_INTEGER,
        });
      }
      return { postId, storageIds };
    });

    await t.withIdentity(identity).mutation(api.posts.deleteDraft, {
      draftId: ids.postId,
    });
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.postId)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) =>
        ctx.db
          .query("pendingUploads")
          .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
          .take(101),
      ),
    ).resolves.toHaveLength(101);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.run(async (ctx) =>
        ctx.db
          .query("pendingUploads")
          .withIndex("by_postId", (q) => q.eq("postId", ids.postId))
          .take(1),
      ),
    ).resolves.toEqual([]);
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.storageIds[0])),
    ).resolves.toBeNull();
  });

  it("reclaims a draft asset retained by an existing cleanup job", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(
      t,
      "retained-draft-cleanup@example.com",
    );
    const ids = await t.run(async (ctx) => {
      const draftAsset = await ctx.storage.store(new Blob(["draft asset"]));
      const unrelatedAsset = await ctx.storage.store(
        new Blob(["unrelated asset"]),
      );
      const postId = await ctx.db.insert("posts", {
        title: "Retained draft asset",
        body: "Body",
        tags: [],
        authorId: identity.subject,
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const draftClaim = await ctx.db.insert("pendingUploads", {
        userId: identity.subject,
        postId,
        storageId: draftAsset,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      const unrelatedClaim = await ctx.db.insert("pendingUploads", {
        userId: "other-owner",
        storageId: unrelatedAsset,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      const jobId = await ctx.db.insert("draftUploadCleanupJobs", {
        postId,
        cursor: null,
        lockedUntil: 0,
        updatedAt: 1,
        storageIds: [draftAsset],
        retainedStorageIds: [draftAsset],
        removeConsumed: true,
        leaseVersion: 1,
      });
      return {
        draftAsset,
        draftClaim,
        unrelatedAsset,
        unrelatedClaim,
        postId,
        jobId,
      };
    });

    await t.withIdentity(identity).mutation(api.posts.deleteDraft, {
      draftId: ids.postId,
    });
    await t.mutation(internal.postDeletion.continueDraftUploadCleanup, {
      jobId: ids.jobId,
      leaseVersion: 2,
    });

    await expect(
      t.run(async (ctx) => ctx.db.get(ids.draftClaim)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.draftAsset)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.unrelatedClaim)),
    ).resolves.not.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.unrelatedAsset)),
    ).resolves.not.toBeNull();
  });

  it.each([NaN, Infinity, -Infinity, -1, 1.5])(
    "fails before hiding a post when its topic stat is invalid: %s",
    async (publishedCount) => {
      const t = convexTest(schema, modules);
      const identity = await createAuthenticatedTestUser(
        t,
        `invalid-stat-${String(publishedCount)}@example.com`,
      );
      const postId = await t.run(async (ctx) => {
        const postId = await ctx.db.insert("posts", {
          title: "Invalid stat",
          body: "Body",
          tags: ["Technology"],
          authorId: identity.subject,
          status: "published",
          publishedAt: 1,
          commentCount: 0,
          likeCount: 0,
          uniqueViewCount: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("discoverPostTopics", {
          postId,
          tag: "Technology",
          publishedAt: 1,
        });
        await ctx.db.insert("topicStats", {
          tag: "Technology",
          publishedCount,
        });
        await ctx.db.insert("stats", { totalPosts: 1 });
        return postId;
      });

      await expect(
        t
          .withIdentity(identity)
          .mutation(api.posts.deletePublishedPost, { postId }),
      ).rejects.toThrow("Topic stat");
      await expect(
        t.run(async (ctx) => ctx.db.get(postId)),
      ).resolves.toMatchObject({
        status: "published",
      });
    },
  );

  it("preserves storage shared by an unrelated pending claim", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(
      t,
      "shared-upload@example.com",
    );
    const ids = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["shared"]));
      const postId = await ctx.db.insert("posts", {
        title: "Shared upload",
        body: "Body",
        tags: [],
        authorId: identity.subject,
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const targetClaim = await ctx.db.insert("pendingUploads", {
        userId: identity.subject,
        postId,
        storageId,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      const unrelatedClaim = await ctx.db.insert("pendingUploads", {
        userId: "other-owner",
        storageId,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      return { postId, storageId, targetClaim, unrelatedClaim };
    });

    await t.withIdentity(identity).mutation(api.posts.deletePublishedPost, {
      postId: ids.postId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(
      t.run(async (ctx) => ctx.db.get(ids.targetClaim)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.unrelatedClaim)),
    ).resolves.not.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.storageId)),
    ).resolves.not.toBeNull();
  });

  it("preserves a cover object referenced by an unrelated claim", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const identity = await createAuthenticatedTestUser(
      t,
      "shared-cover@example.com",
    );
    const ids = await t.run(async (ctx) => {
      const cover = await ctx.storage.store(new Blob(["cover"]));
      const postId = await ctx.db.insert("posts", {
        title: "Shared cover",
        body: "Body",
        tags: [],
        authorId: identity.subject,
        imageStorageId: cover,
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const claimId = await ctx.db.insert("pendingUploads", {
        userId: "other-owner",
        storageId: cover,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      return { postId, cover, claimId };
    });

    await t.withIdentity(identity).mutation(api.posts.deletePublishedPost, {
      postId: ids.postId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.claimId)),
    ).resolves.not.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.cover)),
    ).resolves.not.toBeNull();
  });

  it("reclaims removed published-edit assets while preserving retained assets", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    const ids = await t.run(async (ctx) => {
      const removed = await ctx.storage.store(new Blob(["removed"]));
      const retained = await ctx.storage.store(new Blob(["retained"]));
      const postId = await ctx.db.insert("posts", {
        title: "Edited assets",
        body: "Body",
        tags: [],
        authorId: "owner",
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const removedClaim = await ctx.db.insert("pendingUploads", {
        userId: "owner",
        postId,
        storageId: removed,
        consumedAt: 1,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      const jobId = await ctx.db.insert("draftUploadCleanupJobs", {
        postId,
        cursor: null,
        lockedUntil: 0,
        updatedAt: 1,
        storageIds: [removed],
        retainedStorageIds: [retained],
        removeConsumed: true,
        leaseVersion: 1,
      });
      return { jobId, removed, retained, removedClaim };
    });

    await t.mutation(internal.postDeletion.continueDraftUploadCleanup, {
      jobId: ids.jobId,
      leaseVersion: 1,
    });
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.removedClaim)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.removed)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.retained)),
    ).resolves.not.toBeNull();
  });

  it("ignores stale draft cleanup continuations after a newer lease claims the job", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["draft"]));
      const postId = await ctx.db.insert("posts", {
        title: "Stale draft",
        body: "Body",
        tags: [],
        authorId: "owner",
        status: "draft",
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const claimId = await ctx.db.insert("pendingUploads", {
        userId: "owner",
        postId,
        storageId,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      const jobId = await ctx.db.insert("draftUploadCleanupJobs", {
        postId,
        cursor: null,
        lockedUntil: Date.now() + 60_000,
        updatedAt: Date.now(),
        leaseVersion: 2,
      });
      return { claimId, jobId, storageId };
    });

    await t.mutation(internal.postDeletion.continueDraftUploadCleanup, {
      jobId: ids.jobId,
      leaseVersion: 1,
    });
    await expect(
      t.run(async (ctx) => ctx.db.get(ids.claimId)),
    ).resolves.not.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.storageId)),
    ).resolves.not.toBeNull();
  });

  it("preserves an asset reintroduced before an old cleanup continuation runs", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["reintroduced"]));
      const postId = await ctx.db.insert("posts", {
        title: "Reintroduced asset",
        body: "Body",
        tags: [],
        authorId: "owner",
        imageStorageId: storageId,
        status: "published",
        publishedAt: 1,
        commentCount: 0,
        likeCount: 0,
        uniqueViewCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const claimId = await ctx.db.insert("pendingUploads", {
        userId: "owner",
        postId,
        storageId,
        consumedAt: 1,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      const jobId = await ctx.db.insert("draftUploadCleanupJobs", {
        postId,
        cursor: null,
        lockedUntil: 0,
        updatedAt: 1,
        storageIds: [storageId],
        retainedStorageIds: [],
        removeConsumed: true,
        leaseVersion: 2,
      });
      return { storageId, claimId, jobId };
    });

    await t.mutation(internal.postDeletion.continueDraftUploadCleanup, {
      jobId: ids.jobId,
      leaseVersion: 2,
    });

    await expect(
      t.run(async (ctx) => ctx.db.get(ids.claimId)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ctx.storage.getUrl(ids.storageId)),
    ).resolves.not.toBeNull();
  });

  it("merges repeated edit cleanup state without losing retained assets", async () => {
    const { mergeCleanupStorageState } = await import("./postDeletion");
    expect(
      mergeCleanupStorageState(["removed"], ["retained"], ["removed"]),
    ).toEqual({
      storageIds: ["removed", "retained"],
      retainedStorageIds: ["removed"],
    });
  });
});
