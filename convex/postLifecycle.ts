import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";

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
