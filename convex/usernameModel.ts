/** Transactional ownership rules shared by the username API and lifecycle. */
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isReservedUsername, normalizeUsername } from "../lib/username";
import { getOwnProfile } from "./profileModel";
import { rateLimiter, USERNAME_CLAIM_LIMIT } from "./rateLimiter";

/** One bounded retirement batch; larger accounts schedule a continuation. */
export const MAX_RETIRE_BATCH = 100;

/** One bounded lookup page; callers compose at most this many authors. */
export const MAX_USERNAME_LOOKUP = 50;

export type UsernameSave =
  | { kind: "saved"; username: string; revision: number }
  | { kind: "conflict" }
  | { kind: "unavailable" }
  | { kind: "cooldown"; retryAfterMs: number };

export const usernameSaveValidator = v.union(
  v.object({
    kind: v.literal("saved"),
    username: v.string(),
    revision: v.number(),
  }),
  v.object({ kind: v.literal("conflict") }),
  v.object({ kind: v.literal("unavailable") }),
  v.object({ kind: v.literal("cooldown"), retryAfterMs: v.number() }),
);

export const usernameAvailabilityValidator = v.union(
  v.object({ status: v.literal("invalid"), message: v.string() }),
  v.object({ status: v.literal("taken") }),
  v.object({ status: v.literal("current") }),
  v.object({ status: v.literal("owned") }),
  v.object({ status: v.literal("available") }),
);

export async function findClaim(
  ctx: QueryCtx | MutationCtx,
  canonical: string,
) {
  return await ctx.db
    .query("usernameClaims")
    .withIndex("by_usernameLower", (q) => q.eq("usernameLower", canonical))
    .unique();
}

/** Classification precedes token consumption; later failures abort all writes. */
export async function saveUsername(
  ctx: MutationCtx,
  user: Doc<"users">,
  expectedRevision: number,
  input: string,
): Promise<UsernameSave> {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new ConvexError("Invalid revision");
  }
  const normalized = normalizeUsername(input);
  if (!normalized.ok) {
    throw new ConvexError({ field: "username", message: normalized.message });
  }
  const { styled, canonical } = normalized;
  const revision = user.usernameRevision ?? 0;

  // A lost-response retry can still carry the revision from before the save.
  // Only the exact saved styled target reconciles; stale changes still conflict.
  if (styled === user.username && canonical === user.usernameLower) {
    return { kind: "saved", username: styled, revision };
  }
  if (expectedRevision !== revision) return { kind: "conflict" };

  if (canonical === user.usernameLower) {
    await ctx.db.patch(user._id, {
      username: styled,
      usernameRevision: revision + 1,
    });
    return { kind: "saved", username: styled, revision: revision + 1 };
  }

  const existing = await findClaim(ctx, canonical);
  if (existing) {
    // An absent owner is a permanent block, never a free name.
    if (existing.ownerUserId !== user.userId) return { kind: "unavailable" };
  } else {
    if (isReservedUsername(canonical)) return { kind: "unavailable" };
    const status = await rateLimiter.limit(ctx, USERNAME_CLAIM_LIMIT, {
      key: user.userId,
    });
    if (!status.ok) {
      return { kind: "cooldown", retryAfterMs: status.retryAfter ?? 0 };
    }
    await ctx.db.insert("usernameClaims", {
      usernameLower: canonical,
      ownerUserId: user.userId,
      createdAt: Date.now(),
    });

    // The indexed check and insert share this serializable transaction. This
    // defensive invariant also aborts the consumed token if uniqueness fails.
    const holders = await ctx.db
      .query("usernameClaims")
      .withIndex("by_usernameLower", (q) => q.eq("usernameLower", canonical))
      .take(2);
    if (holders.length !== 1 || holders[0].ownerUserId !== user.userId) {
      throw new ConvexError("Username claim conflicted; retry");
    }
  }

  await ctx.db.patch(user._id, {
    username: styled,
    usernameLower: canonical,
    usernameRevision: revision + 1,
  });
  return { kind: "saved", username: styled, revision: revision + 1 };
}

/** The owner's current styled username, or null when they have none. */
export async function usernameForOwner(
  ctx: QueryCtx,
  userId: string,
): Promise<string | null> {
  const user = await getOwnProfile(ctx, userId);
  return user?.username ?? null;
}

/**
 * Current usernames for a bounded, de-duplicated set of owners. Duplicate
 * inputs collapse to one read so a repeated author costs nothing extra.
 */
export async function usernamesForOwners(
  ctx: QueryCtx,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds)).slice(0, MAX_USERNAME_LOOKUP);
  const entries = await Promise.all(
    unique.map(async (userId) => {
      const username = await usernameForOwner(ctx, userId);
      return [userId, username] as const;
    }),
  );
  return new Map(
    entries.filter(
      (entry): entry is readonly [string, string] => entry[1] !== null,
    ),
  );
}
