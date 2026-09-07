import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import {
  extractImageStorageIds,
  extractPlainText,
  MAX_POST_TEXT_LENGTH,
  MIN_POST_TEXT_LENGTH,
  parsePostBody,
} from "../lib/post-content";
import { isValidPostTags } from "../lib/constants/post-tags";
import { mergeCleanupStorageState } from "./postDeletion";
import { incrementPostCountInTransaction } from "./stats";
import { adjustPublishedPostCount } from "./profilePostCount";
import { syncPublishedPostProjection } from "./discoverProjection";
import { FANOUT_BATCH_SIZE } from "./notifications";
import { FEED_BATCH_SIZE } from "./feed";

type WriteProposal = {
  title: string;
  body: string;
  tags: string[];
  imageStorageId?: Id<"_storage">;
};

type WriteExecutionArgs = {
  postId?: Id<"posts">;
  expectedUpdatedAt?: number;
  proposal: WriteProposal;
};

export type WriteExecutionResult = {
  postId: Id<"posts">;
  updatedAt: number;
  status: PostStatus;
};

type UploadClaimContext = Pick<MutationCtx, "db">;

export const POST_STATUSES = ["draft", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/**
 * Retrieves a post only if it has published status.
 *
 * @param ctx - Query or mutation context
 * @param postId - The post ID to retrieve
 * @returns The post if published, null otherwise
 */
export async function getPublishedPost(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  postId: Id<"posts">,
): Promise<Doc<"posts"> | null> {
  const post = await ctx.db.get(postId);
  return post && post.status === "published" ? post : null;
}

/**
 * Retrieves a published post or throws an error if not found or not published.
 *
 * @param ctx - Query or mutation context
 * @param postId - The post ID to retrieve
 * @returns The published post
 * @throws ConvexError if the post is not found or not published
 */
export async function requirePublishedPost(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  postId: Id<"posts">,
): Promise<Doc<"posts">> {
  const post = await getPublishedPost(ctx, postId);
  if (!post) throw new ConvexError("Post not found.");
  return post;
}

/**
 * Validates that storage IDs have valid pending upload claims for a draft.
 * Ensures each image was uploaded by the user and hasn't been consumed or expired.
 *
 * @param ctx - Mutation context with database access
 * @param storageIds - Array of storage IDs to validate
 * @param userId - The user who should own the uploads
 * @param now - Current timestamp
 * @param draftId - Optional draft ID the uploads should be associated with
 * @returns Array of validated pending upload claim IDs
 * @throws ConvexError if any claim is invalid or expired
 */
export async function validateDraftUploadClaims(
  ctx: UploadClaimContext,
  storageIds: Id<"_storage">[],
  userId: string,
  now: number,
  draftId?: Id<"posts">,
): Promise<Id<"pendingUploads">[]> {
  const seen = new Set<string>();
  const claimIds: Id<"pendingUploads">[] = [];

  for (const storageId of storageIds) {
    if (seen.has(storageId)) continue;
    seen.add(storageId);

    const claims = await ctx.db
      .query("pendingUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .take(2);
    const claim = claims.length === 1 ? claims[0] : null;

    if (
      !claim ||
      claim.userId !== userId ||
      claim.storageId !== storageId ||
      claim.consumedAt !== undefined ||
      (claim.postId !== undefined && claim.postId !== draftId)
    ) {
      throw new ConvexError("Invalid inline upload claim");
    }
    if (claim.expiresAt <= now) {
      throw new ConvexError("Inline image expired");
    }
    claimIds.push(claim._id);
  }

  return claimIds;
}

/**
 * Validates pending upload claims for editing a published post.
 * Only validates new images that weren't in the original post.
 *
 * @param ctx - Mutation context with database access
 * @param existingStorageIds - Storage IDs already in the published post
 * @param submittedStorageIds - Storage IDs in the edited version
 * @param userId - The user who should own the uploads
 * @param now - Current timestamp
 * @param postId - The post being edited
 * @returns Array of validated pending upload claim IDs for new images
 * @throws ConvexError if any claim is invalid or expired
 */
export async function validatePublishedEditUploadClaims(
  ctx: UploadClaimContext,
  existingStorageIds: Id<"_storage">[],
  submittedStorageIds: Id<"_storage">[],
  userId: string,
  now: number,
  postId: Id<"posts">,
): Promise<Id<"pendingUploads">[]> {
  const existing = new Set(existingStorageIds);
  const seen = new Set<string>();
  const claimIds: Id<"pendingUploads">[] = [];

  for (const storageId of submittedStorageIds) {
    if (existing.has(storageId) || seen.has(storageId)) continue;
    seen.add(storageId);

    const claims = await ctx.db
      .query("pendingUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .take(2);
    const claim = claims.length === 1 ? claims[0] : null;

    if (
      !claim ||
      claim.userId !== userId ||
      claim.storageId !== storageId ||
      claim.consumedAt !== undefined ||
      (claim.postId !== undefined && claim.postId !== postId)
    ) {
      throw new ConvexError("Invalid inline upload claim");
    }
    if (claim.expiresAt <= now) {
      throw new ConvexError("Inline image expired");
    }
    claimIds.push(claim._id);
  }

  return claimIds;
}

function getStructuredBody(body: string) {
  const parsed = parsePostBody(body);
  return parsed.kind === "structured" ? parsed.document : null;
}

function getReferencedStorageIds(
  body: string,
  imageStorageId?: Id<"_storage">,
): Id<"_storage">[] {
  const document = getStructuredBody(body);
  if (!document) return [];
  return [
    ...(imageStorageId === undefined ? [] : [imageStorageId]),
    ...(extractImageStorageIds(document.blocks) as Id<"_storage">[]),
  ];
}

function validateDraftProposal(proposal: WriteProposal) {
  if (proposal.title.length > 100) {
    throw new ConvexError("Invalid title");
  }
  const document = getStructuredBody(proposal.body);
  if (
    !document ||
    extractPlainText(document.blocks).trim().length > MAX_POST_TEXT_LENGTH
  ) {
    throw new ConvexError("Invalid content");
  }
  if (!isValidPostTags(proposal.tags)) {
    throw new ConvexError("Invalid tags");
  }
}

function validatePublicationProposal(proposal: WriteProposal) {
  validateDraftProposal(proposal);
  const document = getStructuredBody(proposal.body);
  if (
    !document ||
    proposal.title.trim().length === 0 ||
    extractPlainText(document.blocks).trim().length < MIN_POST_TEXT_LENGTH
  ) {
    throw new ConvexError("Invalid content");
  }
}

async function scheduleDraftCleanup(
  ctx: MutationCtx,
  postId: Id<"posts">,
  removedStorageIds: Id<"_storage">[],
  retainedStorageIds: Id<"_storage">[],
  now: number,
  removeConsumed: boolean,
) {
  const existingCleanupJob = await ctx.db
    .query("draftUploadCleanupJobs")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .unique();
  if (removedStorageIds.length === 0 && !existingCleanupJob) return;

  const merged = mergeCleanupStorageState(
    existingCleanupJob?.storageIds ?? [],
    removedStorageIds,
    retainedStorageIds,
  );
  const leaseVersion = (existingCleanupJob?.leaseVersion ?? 0) + 1;
  const cleanupJobId =
    existingCleanupJob?._id ??
    (await ctx.db.insert("draftUploadCleanupJobs", {
      postId,
      cursor: null,
      lockedUntil: 0,
      updatedAt: now,
      storageIds: merged.storageIds as Id<"_storage">[],
      retainedStorageIds: merged.retainedStorageIds as Id<"_storage">[],
      removeConsumed,
      leaseVersion,
    }));
  if (existingCleanupJob) {
    await ctx.db.patch(existingCleanupJob._id, {
      cursor: null,
      lockedUntil: 0,
      updatedAt: now,
      storageIds: merged.storageIds as Id<"_storage">[],
      retainedStorageIds: merged.retainedStorageIds as Id<"_storage">[],
      removeConsumed,
      leaseVersion,
    });
  }
  await ctx.scheduler.runAfter(
    0,
    internal.postDeletion.continueDraftUploadCleanup,
    { jobId: cleanupJobId, leaseVersion },
  );
}

export async function executeSaveDraft(
  ctx: MutationCtx,
  userId: string,
  args: WriteExecutionArgs,
): Promise<WriteExecutionResult> {
  validateDraftProposal(args.proposal);
  const draft =
    args.postId === undefined ? null : await ctx.db.get(args.postId);
  if (
    args.postId !== undefined &&
    (!draft || draft.authorId !== userId || draft.status !== "draft")
  ) {
    throw new ConvexError("Post not found.");
  }
  if (
    draft &&
    (args.expectedUpdatedAt === undefined ||
      draft.updatedAt !== args.expectedUpdatedAt)
  ) {
    throw new ConvexError("Document changed elsewhere.");
  }

  const now = Date.now();
  const referencedStorageIds = getReferencedStorageIds(
    args.proposal.body,
    args.proposal.imageStorageId,
  );
  const claimIds = await validateDraftUploadClaims(
    ctx,
    referencedStorageIds,
    userId,
    now,
    draft?._id,
  );
  const updatedAt = draft
    ? Math.max(now, draft.updatedAt) + 1
    : Math.max(now, 1);
  const attachedClaims = draft
    ? await ctx.db
        .query("pendingUploads")
        .withIndex("by_postId", (q) => q.eq("postId", draft._id))
        .take(100)
    : [];
  const attachedStorageIds = attachedClaims.flatMap((claim) =>
    claim.storageId === undefined ? [] : [claim.storageId],
  );
  const postId =
    draft?._id ??
    (await ctx.db.insert("posts", {
      title: args.proposal.title,
      body: args.proposal.body,
      tags: args.proposal.tags,
      imageStorageId: args.proposal.imageStorageId,
      authorId: userId,
      status: "draft",
      commentCount: 0,
      likeCount: 0,
      uniqueViewCount: 0,
      createdAt: updatedAt,
      updatedAt,
    }));

  if (draft) {
    const oldStorageIds = getReferencedStorageIds(
      draft.body,
      draft.imageStorageId,
    );
    const removedStorageIds = [
      ...new Set(
        [...oldStorageIds, ...attachedStorageIds].filter(
          (storageId) => !referencedStorageIds.includes(storageId),
        ),
      ),
    ];
    await ctx.db.patch(draft._id, {
      title: args.proposal.title,
      body: args.proposal.body,
      tags: args.proposal.tags,
      imageStorageId: args.proposal.imageStorageId,
      updatedAt,
    });
    await scheduleDraftCleanup(
      ctx,
      draft._id,
      removedStorageIds,
      referencedStorageIds,
      updatedAt,
      false,
    );
  }

  for (const claimId of claimIds) {
    await ctx.db.patch(claimId, {
      postId,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  }
  return { postId, updatedAt, status: "draft" };
}

export async function executePublish(
  ctx: MutationCtx,
  userId: string,
  args: WriteExecutionArgs,
): Promise<WriteExecutionResult> {
  validatePublicationProposal(args.proposal);
  const draft =
    args.postId === undefined ? null : await ctx.db.get(args.postId);
  if (
    args.postId !== undefined &&
    (!draft || draft.authorId !== userId || draft.status !== "draft")
  ) {
    throw new ConvexError("Post not found.");
  }
  if (
    draft &&
    (args.expectedUpdatedAt === undefined ||
      draft.updatedAt !== args.expectedUpdatedAt)
  ) {
    throw new ConvexError("Document changed elsewhere.");
  }

  const now = Date.now();
  const referencedStorageIds = getReferencedStorageIds(
    args.proposal.body,
    args.proposal.imageStorageId,
  );
  const claimIds = await validateDraftUploadClaims(
    ctx,
    referencedStorageIds,
    userId,
    now,
    draft?._id,
  );
  const postId =
    draft?._id ??
    (await ctx.db.insert("posts", {
      title: args.proposal.title,
      body: args.proposal.body,
      tags: args.proposal.tags,
      imageStorageId: args.proposal.imageStorageId,
      authorId: userId,
      status: "published",
      publishedAt: now,
      commentCount: 0,
      likeCount: 0,
      uniqueViewCount: 0,
      createdAt: now,
      updatedAt: now,
    }));
  const updatedAt = draft
    ? Math.max(now, draft.updatedAt, draft.publishedAt ?? 0) + 1
    : now;
  if (draft) {
    await ctx.db.patch(draft._id, {
      title: args.proposal.title,
      body: args.proposal.body,
      tags: args.proposal.tags,
      imageStorageId: args.proposal.imageStorageId,
      status: "published",
      publishedAt: now,
      updatedAt,
    });
  }
  for (const claimId of claimIds) {
    await ctx.db.patch(claimId, {
      postId,
      consumedAt: now,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  }
  await incrementPostCountInTransaction(ctx);
  await adjustPublishedPostCount(ctx, userId, 1);
  await syncPublishedPostProjection(ctx, postId);
  await ctx.scheduler.runAfter(0, internal.notifications.fanOutForPost, {
    postId,
    authorId: userId,
    paginationOpts: { numItems: FANOUT_BATCH_SIZE, cursor: null },
  });
  await ctx.scheduler.runAfter(0, internal.feed.fanOutForPost, {
    postId,
    authorId: userId,
    paginationOpts: { numItems: FEED_BATCH_SIZE, cursor: null },
    retryCount: 0,
  });
  return { postId, updatedAt, status: "published" };
}

export async function executePublishedUpdate(
  ctx: MutationCtx,
  userId: string,
  args: WriteExecutionArgs,
): Promise<WriteExecutionResult> {
  validatePublicationProposal(args.proposal);
  if (args.postId === undefined || args.expectedUpdatedAt === undefined) {
    throw new ConvexError("Post version is required.");
  }
  const post = await ctx.db.get(args.postId);
  if (
    !post ||
    post.authorId !== userId ||
    post.status !== "published" ||
    post.publishedAt === undefined
  ) {
    throw new ConvexError("Post not found.");
  }
  if (post.updatedAt !== args.expectedUpdatedAt) {
    throw new ConvexError("Document changed elsewhere.");
  }

  const now = Date.now();
  const oldStorageIds = getReferencedStorageIds(post.body, post.imageStorageId);
  const submittedStorageIds = getReferencedStorageIds(
    args.proposal.body,
    args.proposal.imageStorageId,
  );
  const claimIds = await validatePublishedEditUploadClaims(
    ctx,
    oldStorageIds,
    submittedStorageIds,
    userId,
    now,
    post._id,
  );
  const updatedAt = Math.max(now, post.updatedAt, post.publishedAt) + 1;
  const removedStorageIds = oldStorageIds.filter(
    (storageId) => !submittedStorageIds.includes(storageId),
  );
  await ctx.db.patch(post._id, {
    title: args.proposal.title,
    body: args.proposal.body,
    tags: args.proposal.tags,
    imageStorageId: args.proposal.imageStorageId,
    updatedAt,
  });
  for (const claimId of claimIds) {
    await ctx.db.patch(claimId, {
      postId: post._id,
      consumedAt: updatedAt,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  }
  await scheduleDraftCleanup(
    ctx,
    post._id,
    removedStorageIds,
    submittedStorageIds,
    updatedAt,
    true,
  );
  await syncPublishedPostProjection(ctx, post._id, post.tags);
  return { postId: post._id, updatedAt, status: "published" };
}
