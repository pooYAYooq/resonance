import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";

type UploadClaimContext = Pick<MutationCtx, "db">;

export const POST_STATUSES = ["draft", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export async function getPublishedPost(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  postId: Id<"posts">,
): Promise<Doc<"posts"> | null> {
  const post = await ctx.db.get(postId);
  return post && post.status === "published" ? post : null;
}

export async function requirePublishedPost(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  postId: Id<"posts">,
): Promise<Doc<"posts">> {
  const post = await getPublishedPost(ctx, postId);
  if (!post) throw new ConvexError("Post not found.");
  return post;
}

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
