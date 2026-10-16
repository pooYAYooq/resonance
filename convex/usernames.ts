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
