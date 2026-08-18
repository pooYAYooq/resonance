import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

type UploadClaimContext = Pick<MutationCtx, "db">;

export const POST_STATUSES = ["draft", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export function getPostStatus(post: Pick<Doc<"posts">, "status">): PostStatus {
  return post.status ?? "published";
}

export function getPublishedAt(
  post: Pick<Doc<"posts">, "status" | "publishedAt" | "createdAt">,
): number | undefined {
  if (getPostStatus(post) !== "published") return undefined;
  return post.publishedAt ?? post.createdAt;
}

export async function getPublishedPost(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  postId: Id<"posts">,
): Promise<Doc<"posts"> | null> {
  const post = await ctx.db.get(postId);
  return post && getPostStatus(post) === "published" ? post : null;
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

export const backfillPublishedPosts = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    done: v.boolean(),
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("posts")
      .order("asc")
      .paginate(args.paginationOpts);

    for (const post of result.page) {
      const current = await ctx.db.get(post._id);
      if (!current) continue;

      if (current.status === undefined) {
        await ctx.db.patch(current._id, {
          status: "published",
          publishedAt: current.createdAt,
        });
      } else if (
        current.status === "published" &&
        current.publishedAt === undefined
      ) {
        await ctx.db.patch(current._id, { publishedAt: current.createdAt });
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.postLifecycle.backfillPublishedPosts,
        {
          paginationOpts: {
            ...args.paginationOpts,
            cursor: result.continueCursor,
          },
        },
      );
    }

    return { done: result.isDone, processed: result.page.length };
  },
});
