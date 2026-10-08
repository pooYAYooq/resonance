import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { extractImageStorageIds, parsePostBody } from "../lib/post-content";

export function getPendingPostEdit(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  postId: Id<"posts">,
) {
  return ctx.db
    .query("posts")
    .withIndex("by_sourcePostId", (q) => q.eq("sourcePostId", postId))
    .unique();
}

export function getPostMediaStorageIds(
  post: Pick<Doc<"posts">, "body" | "imageStorageId"> | null,
): Id<"_storage">[] {
  if (!post) return [];
  const parsed = parsePostBody(post.body);
  return [
    ...new Set([
      ...(post.imageStorageId ? [post.imageStorageId] : []),
      ...(parsed.kind === "structured"
        ? (extractImageStorageIds(parsed.document.blocks) as Id<"_storage">[])
        : []),
    ]),
  ];
}
