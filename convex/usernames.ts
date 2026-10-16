/** Narrow public claim/availability APIs and trusted permanent retirement. */
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { getOwnProfile } from "./profileModel";
import { isReservedUsername, normalizeUsername } from "../lib/username";
import { rateLimiter, USERNAME_CLAIM_LIMIT } from "./rateLimiter";
import {
  findClaim,
  MAX_RETIRE_BATCH,
  saveUsername,
  usernamesForOwners,
  usernameAvailabilityValidator,
  usernameSaveValidator,
} from "./usernameModel";

export const claimUsername = mutation({
  args: { username: v.string(), expectedRevision: v.number() },
  returns: usernameSaveValidator,
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new ConvexError("Unauthorized");
    const user = await getOwnProfile(ctx, authUser._id);
    if (!user) throw new ConvexError("Unauthorized");
    return await saveUsername(ctx, user, args.expectedRevision, args.username);
  },
});

export const checkUsernameAvailability = query({
  args: { username: v.string() },
  returns: usernameAvailabilityValidator,
  handler: async (ctx, args) => {
    const normalized = normalizeUsername(args.username);
    if (!normalized.ok) {
      return { status: "invalid" as const, message: normalized.message };
    }
    const { canonical } = normalized;
    const authUser = await authComponent.safeGetAuthUser(ctx);
    const user = authUser ? await getOwnProfile(ctx, authUser._id) : null;
    if (user && canonical === user.usernameLower) {
      return { status: "current" as const };
    }
    const claim = await findClaim(ctx, canonical);
    if (claim) {
      if (user && claim.ownerUserId === user.userId) {
        return { status: "owned" as const };
      }
      return { status: "taken" as const };
    }
    if (isReservedUsername(canonical)) return { status: "taken" as const };
    return { status: "available" as const };
  },
});

/** Deletion integration calls this internally; active users cannot reset quota. */
export const retireAccount = internalMutation({
  args: { ownerUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { ownerUserId }): Promise<null> => {
    // Remove the live profile first. Remaining owned claims stay unavailable
    // even before their owner associations are stripped by later batches.
    const profile = await getOwnProfile(ctx, ownerUserId);
    if (profile) await ctx.db.delete(profile._id);
    const claims = await ctx.db
      .query("usernameClaims")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
      .take(MAX_RETIRE_BATCH + 1);
    for (const claim of claims.slice(0, MAX_RETIRE_BATCH)) {
      await ctx.db.patch(claim._id, { ownerUserId: undefined });
    }
    if (claims.length > MAX_RETIRE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.usernames.retireAccount, {
        ownerUserId,
      });
    } else {
      await rateLimiter.reset(ctx, USERNAME_CLAIM_LIMIT, { key: ownerUserId });
    }
    return null;
  },
});

/**
 * Resolves any spelling of a username to its owner's current address. Only the
 * exact canonical lowercase form renders a profile; every other spelling of an
 * owned name (mixed-case current spellings, previous names) redirects to the
 * canonical address. Missing, invalid, reserved, and ownerless names resolve
 * to `notFound` without disclosing ownership or history.
 */
export const resolveUsername = query({
  args: { username: v.string() },
  returns: v.union(
    v.object({
      kind: v.literal("profile"),
      ownerUserId: v.string(),
      username: v.string(),
    }),
    v.object({ kind: v.literal("redirect"), username: v.string() }),
    v.object({ kind: v.literal("notFound") }),
  ),
  handler: async (ctx, args) => {
    const normalized = normalizeUsername(args.username);
    if (!normalized.ok) return { kind: "notFound" as const };

    const claim = await findClaim(ctx, normalized.canonical);
    if (!claim?.ownerUserId) return { kind: "notFound" as const };

    const owner = await getOwnProfile(ctx, claim.ownerUserId);
    const current = owner?.username;
    const currentLower = owner?.usernameLower;
    if (!current || !currentLower) {
      // The claim outlived its owner's profile: the address is unavailable.
      return { kind: "notFound" as const };
    }
    if (normalized.styled === currentLower) {
      return {
        kind: "profile" as const,
        ownerUserId: claim.ownerUserId,
        username: current,
      };
    }
    return { kind: "redirect" as const, username: currentLower };
  },
});

/**
 * Current usernames for a set of owner IDs in argument order. Duplicate inputs
 * return duplicate entries; reads are de-duplicated and bounded to
 * `MAX_USERNAME_LOOKUP` distinct owners.
 */
export const getUsernamesForOwners = query({
  args: { userIds: v.array(v.string()) },
  returns: v.array(
    v.object({
      userId: v.string(),
      username: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const known = await usernamesForOwners(ctx, args.userIds);
    return args.userIds.map((userId) => ({
      userId,
      username: known.get(userId) ?? null,
    }));
  },
});
