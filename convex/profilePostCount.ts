import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";

export function isValidPublishedPostCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export async function adjustPublishedPostCount(
  ctx: Pick<MutationCtx, "db">,
  userId: string,
  delta: 1 | -1,
): Promise<void> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!user) throw new ConvexError("User profile counter is missing.");

  if (!isValidPublishedPostCount(user.publishedPostCount)) {
    throw new ConvexError("User profile counter is invalid.");
  }
  const next = user.publishedPostCount + delta;
  if (!isValidPublishedPostCount(next)) {
    throw new ConvexError("User profile counter is invalid.");
  }
  await ctx.db.patch(user._id, { publishedPostCount: next });
}
