import { v, ConvexError } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { extractImageStorageIds, parsePostBody } from "../lib/post-content";
import { hasActiveSessionMediaClaim } from "./sessionMediaClaims";

const BATCH_SIZE = 100;
const LEASE_MS = 30 * 60 * 1000;

type JobPatch = Partial<
  Pick<
    Doc<"postDeletionJobs">,
    | "stage"
    | "cursor"
    | "commentCursor"
    | "commentId"
    | "commentLikeCursor"
    | "analyticsCursor"
    | "analyticsLikesCount"
    | "analyticsViewsCount"
    | "imageStorageId"
  >
>;

export function mergeCleanupStorageState(
  existingStorageIds: readonly string[],
  removedStorageIds: readonly string[],
  retainedStorageIds: readonly string[],
): { storageIds: string[]; retainedStorageIds: string[] } {
  return {
    storageIds: Array.from(
      new Set([...existingStorageIds, ...removedStorageIds]),
    ),
    retainedStorageIds: Array.from(new Set(retainedStorageIds)),
  };
}

function validCounter(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

async function deleteStorageIfUnclaimed(
  ctx: Pick<MutationCtx, "db" | "storage">,
  storageId: Doc<"postDeletionJobs">["imageStorageId"],
  retainedStorageIds?: Set<string>,
): Promise<void> {
  if (storageId === undefined || retainedStorageIds?.has(storageId)) return;
  if (await hasActiveSessionMediaClaim(ctx, storageId)) return;
  const claims = await ctx.db
    .query("pendingUploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .take(1);
  if (claims.length === 0) await ctx.storage.delete(storageId);
}

function getPostStorageIds(post: Doc<"posts"> | null): string[] {
  if (!post) return [];
  const parsed = parsePostBody(post.body);
  return [
    ...(post.imageStorageId === undefined ? [] : [post.imageStorageId]),
    ...(parsed.kind === "structured"
      ? (extractImageStorageIds(parsed.document.blocks) as string[])
      : []),
  ];
}

export const continuePublishedPostDeletion = internalMutation({
  args: { jobId: v.id("postDeletionJobs"), leaseVersion: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    if (job.leaseVersion !== args.leaseVersion) return null;
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      lockedUntil: now + LEASE_MS,
      updatedAt: now,
    });

    const schedule = async (patch: JobPatch): Promise<null> => {
      await ctx.db.patch(args.jobId, {
        ...patch,
        lockedUntil: now + LEASE_MS,
        leaseVersion: args.leaseVersion + 1,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.postDeletion.continuePublishedPostDeletion,
        {
          jobId: args.jobId,
          leaseVersion: args.leaseVersion + 1,
        },
      );
      return null;
    };

    if (job.stage === "pendingUploads") {
      const result = await ctx.db
        .query("pendingUploads")
        .withIndex("by_postId", (q) => q.eq("postId", job.postId))
        .paginate({
          numItems: BATCH_SIZE,
          maximumRowsRead: BATCH_SIZE,
          cursor: job.cursor,
        });
      for (const claim of result.page) {
        await ctx.db.delete(claim._id);
        await deleteStorageIfUnclaimed(ctx, claim.storageId);
      }
      if (!result.isDone)
        return await schedule({
          cursor: result.continueCursor,
        });
      await deleteStorageIfUnclaimed(ctx, job.imageStorageId);
      return await schedule({
        stage: "comments",
        cursor: null,
      });
    }

    if (job.stage === "comments") {
      const result = await ctx.db
        .query("comments")
        .withIndex("by_postId_and_createdAt", (q) => q.eq("postId", job.postId))
        .paginate({
          numItems: 1,
          maximumRowsRead: 1,
          cursor: job.commentCursor,
        });
      const comment = result.page[0];
      if (!comment)
        return await schedule({
          stage: "likes",
          cursor: null,
          commentCursor: null,
        });
      return await schedule({
        stage: "commentLikes",
        commentId: comment._id,
        commentCursor: result.continueCursor,
        commentLikeCursor: null,
      });
    }

    if (job.stage === "commentLikes") {
      if (!job.commentId) return await schedule({ stage: "comments" });
      const result = await ctx.db
        .query("commentLikes")
        .withIndex("by_commentId_and_userId", (q) =>
          q.eq("commentId", job.commentId!),
        )
        .paginate({
          numItems: BATCH_SIZE,
          maximumRowsRead: BATCH_SIZE,
          cursor: job.commentLikeCursor,
        });
      for (const row of result.page) await ctx.db.delete(row._id);
      if (!result.isDone)
        return await schedule({ commentLikeCursor: result.continueCursor });
      await ctx.db.delete(job.commentId);
      return await schedule({ stage: "comments", commentLikeCursor: null });
    }

    if (job.stage === "likes") {
      if (!job.authorId)
        throw new ConvexError("Deletion job is missing author.");
      const result = await ctx.db
        .query("likes")
        .withIndex("by_postId", (q) => q.eq("postId", job.postId))
        .paginate({
          numItems: BATCH_SIZE,
          maximumRowsRead: BATCH_SIZE,
          cursor: job.cursor,
        });
      for (const row of result.page) {
        await ctx.db.delete(row._id);
      }
      if (!result.isDone)
        return await schedule({ cursor: result.continueCursor });
      return await schedule({ stage: "bookmarks", cursor: null });
    }

    if (job.stage === "bookmarks") {
      const result = await ctx.db
        .query("bookmarks")
        .withIndex("by_postId", (q) => q.eq("postId", job.postId))
        .paginate({
          numItems: BATCH_SIZE,
          maximumRowsRead: BATCH_SIZE,
          cursor: job.cursor,
        });
      for (const row of result.page) await ctx.db.delete(row._id);
      if (!result.isDone)
        return await schedule({ cursor: result.continueCursor });
      return await schedule({ stage: "postViews", cursor: null });
    }

    if (job.stage === "postViews") {
      if (!job.authorId)
        throw new ConvexError("Deletion job is missing author.");
      const result = await ctx.db
        .query("postViews")
        .withIndex("by_postId_and_viewerKey", (q) => q.eq("postId", job.postId))
        .paginate({
          numItems: BATCH_SIZE,
          maximumRowsRead: BATCH_SIZE,
          cursor: job.cursor,
        });
      for (const row of result.page) {
        await ctx.db.delete(row._id);
      }
      if (!result.isDone)
        return await schedule({ cursor: result.continueCursor });
      return await schedule({
        stage: "analytics",
        cursor: null,
        analyticsCursor: null,
        analyticsLikesCount: 0,
        analyticsViewsCount: 0,
      });
    }

    if (job.stage === "analytics") {
      if (!job.authorId)
        throw new ConvexError("Deletion job is missing author.");
      const result = await ctx.db
        .query("posts")
        .withIndex("by_authorId", (q) => q.eq("authorId", job.authorId!))
        .paginate({
          numItems: BATCH_SIZE,
          maximumRowsRead: BATCH_SIZE,
          cursor: job.analyticsCursor ?? null,
        });
      const likesReceived =
        (job.analyticsLikesCount ?? 0) +
        result.page.reduce(
          (total, post) =>
            post._id === job.postId
              ? total
              : total + (validCounter(post.likeCount) ? post.likeCount : 0),
          0,
        );
      const uniqueViews =
        (job.analyticsViewsCount ?? 0) +
        result.page.reduce(
          (total, post) =>
            post._id === job.postId
              ? total
              : total +
                (validCounter(post.uniqueViewCount ?? 0)
                  ? (post.uniqueViewCount ?? 0)
                  : 0),
          0,
        );
      if (!result.isDone) {
        return await schedule({
          analyticsCursor: result.continueCursor,
          analyticsLikesCount: likesReceived,
          analyticsViewsCount: uniqueViews,
        });
      }
      const analytics = await ctx.db
        .query("authorAnalytics")
        .withIndex("by_authorId", (q) => q.eq("authorId", job.authorId!))
        .unique();
      if (analytics) {
        await ctx.db.patch(analytics._id, { likesReceived, uniqueViews });
      } else {
        await ctx.db.insert("authorAnalytics", {
          authorId: job.authorId,
          likesReceived,
          uniqueViews,
        });
      }
      return await schedule({ stage: "notifications", cursor: null });
    }

    if (job.stage === "notifications") {
      const result = await ctx.db
        .query("notifications")
        .withIndex("by_postId", (q) => q.eq("postId", job.postId))
        .paginate({
          numItems: BATCH_SIZE,
          maximumRowsRead: BATCH_SIZE,
          cursor: job.cursor,
        });
      for (const row of result.page) {
        const recipient = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", row.recipientId))
          .unique();
        if (recipient) {
          if (!validCounter(recipient.unreadNotificationCount)) {
            throw new ConvexError("Unread notification counter is invalid.");
          }
          if (row.readAt === undefined) {
            await ctx.db.patch(recipient._id, {
              unreadNotificationCount: Math.max(
                0,
                recipient.unreadNotificationCount - 1,
              ),
            });
          }
        }
        await ctx.db.delete(row._id);
      }
      if (!result.isDone)
        return await schedule({ cursor: result.continueCursor });
      return await schedule({ stage: "feed", cursor: null });
    }

    if (job.stage === "feed") {
      const result = await ctx.db
        .query("feed")
        .withIndex("by_postId", (q) => q.eq("postId", job.postId))
        .paginate({
          numItems: BATCH_SIZE,
          maximumRowsRead: BATCH_SIZE,
          cursor: job.cursor,
        });
      for (const row of result.page) await ctx.db.delete(row._id);
      if (!result.isDone)
        return await schedule({ cursor: result.continueCursor });
      await ctx.db.delete(args.jobId);
    }
    return null;
  },
});

export const continueDraftUploadCleanup = internalMutation({
  args: {
    jobId: v.id("draftUploadCleanupJobs"),
    leaseVersion: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    if (job.leaseVersion !== args.leaseVersion) return null;
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      lockedUntil: now + LEASE_MS,
      updatedAt: now,
    });
    const result = await ctx.db
      .query("pendingUploads")
      .withIndex("by_postId", (q) => q.eq("postId", job.postId))
      .paginate({
        numItems: BATCH_SIZE,
        maximumRowsRead: BATCH_SIZE,
        cursor: job.cursor,
      });
    const currentPost = await ctx.db.get(job.postId);
    const retainedStorageIds = new Set([
      ...(job.retainedStorageIds ?? []),
      ...getPostStorageIds(currentPost),
    ]);
    const deletedStorageIds = new Set<string>();
    for (const claim of result.page) {
      const retained =
        claim.storageId !== undefined &&
        retainedStorageIds.has(claim.storageId);
      if (job.removeConsumed || (claim.consumedAt === undefined && !retained)) {
        await ctx.db.delete(claim._id);
        if (
          !job.removeConsumed ||
          claim.storageId === undefined ||
          !(job.storageIds ?? []).includes(claim.storageId)
        ) {
          await deleteStorageIfUnclaimed(
            ctx,
            claim.storageId,
            retainedStorageIds,
          );
          if (claim.storageId !== undefined) {
            deletedStorageIds.add(claim.storageId);
          }
        }
      }
    }
    if (!result.isDone) {
      await ctx.db.patch(args.jobId, {
        cursor: result.continueCursor,
        updatedAt: now,
        lockedUntil: now + LEASE_MS,
        leaseVersion: args.leaseVersion + 1,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.postDeletion.continueDraftUploadCleanup,
        { jobId: args.jobId, leaseVersion: args.leaseVersion + 1 },
      );
    } else {
      const retained = new Set([
        ...(job.retainedStorageIds ?? []),
        ...getPostStorageIds(currentPost),
      ]);
      for (const storageId of job.storageIds ?? []) {
        if (deletedStorageIds.has(storageId)) continue;
        await deleteStorageIfUnclaimed(ctx, storageId, retained);
      }
      await ctx.db.delete(args.jobId);
    }
    return null;
  },
});

export const recoverStaleDeletionJobs = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const jobs = await ctx.db
      .query("postDeletionJobs")
      .withIndex("by_lockedUntil", (q) => q.lte("lockedUntil", now))
      .take(BATCH_SIZE);
    for (const job of jobs) {
      await ctx.db.patch(job._id, {
        lockedUntil: now + LEASE_MS,
        leaseVersion: (job.leaseVersion ?? 0) + 1,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.postDeletion.continuePublishedPostDeletion,
        { jobId: job._id, leaseVersion: (job.leaseVersion ?? 0) + 1 },
      );
    }
    const draftJobs = await ctx.db
      .query("draftUploadCleanupJobs")
      .withIndex("by_lockedUntil", (q) => q.lte("lockedUntil", now))
      .take(BATCH_SIZE);
    for (const job of draftJobs) {
      await ctx.db.patch(job._id, {
        lockedUntil: now + LEASE_MS,
        leaseVersion: (job.leaseVersion ?? 0) + 1,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.postDeletion.continueDraftUploadCleanup,
        { jobId: job._id, leaseVersion: (job.leaseVersion ?? 0) + 1 },
      );
    }
    return null;
  },
});
