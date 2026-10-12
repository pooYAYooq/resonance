/**
 * Shared profile model: validators, stored-shape mapping, and the
 * revision-checked identity write helper. This module registers no public
 * functions; `convex/profiles.ts` exposes the API.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { DISCOVER_BATCH_SIZE } from "./discoverProjection";
import {
  normalizeProfileIdentity,
  type IdentityInput,
  type JoinDateDisplay,
  type SocialProfiles,
} from "../lib/profile-identity";

export type RevisionSave =
  | { kind: "saved"; revision: number }
  | { kind: "conflict" };

export const socialProfilesValidator = v.object({
  instagram: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  behance: v.optional(v.string()),
  youtube: v.optional(v.string()),
  x: v.optional(v.string()),
});

export const joinDateDisplayValidator = v.union(
  v.literal("calendar"),
  v.literal("relative"),
);

export const identityInputValidator = v.object({
  displayName: v.string(),
  bio: v.string(),
  countryCode: v.union(v.string(), v.null()),
  socialProfiles: socialProfilesValidator,
  joinDateDisplay: joinDateDisplayValidator,
});

export const revisionSaveValidator = v.union(
  v.object({ kind: v.literal("saved"), revision: v.number() }),
  v.object({ kind: v.literal("conflict") }),
);

export const authorCardValidator = v.object({
  postId: v.id("posts"),
  title: v.string(),
  imageUrl: v.union(v.string(), v.null()),
  likeCount: v.number(),
});

/** The stored identity as the shared `IdentityInput` shape. */
export function storedIdentity(user: Doc<"users">): IdentityInput {
  return {
    displayName: user.displayName,
    bio: user.bio ?? "",
    countryCode: user.countryCode ?? null,
    socialProfiles: (user.socialProfiles ?? {}) as SocialProfiles,
    joinDateDisplay: (user.joinDateDisplay ?? "calendar") as JoinDateDisplay,
  };
}

export async function getOwnProfile(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

function assertExpectedRevision(expectedRevision: number): void {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new ConvexError("Invalid revision");
  }
}

/**
 * Saves identity at the caller's expected revision. A stale revision returns a
 * conflict without writing; an invalid field throws with its own message; a
 * successful save advances `identityRevision` and repairs denormalized author
 * names when the display name changed.
 */
export async function saveIdentity(
  ctx: MutationCtx,
  user: Doc<"users">,
  expectedRevision: number,
  identity: IdentityInput,
): Promise<RevisionSave> {
  assertExpectedRevision(expectedRevision);
  const revision = user.identityRevision ?? 0;
  if (expectedRevision !== revision) return { kind: "conflict" };

  const normalized = normalizeProfileIdentity(identity);
  if (!normalized.ok) throw new ConvexError(normalized.message);
  const value = normalized.value;
  const hasSocials = Object.keys(value.socialProfiles).length > 0;

  await ctx.db.patch(user._id, {
    displayName: value.displayName,
    bio: value.bio,
    countryCode: value.countryCode ?? undefined,
    socialProfiles: hasSocials ? value.socialProfiles : undefined,
    joinDateDisplay: value.joinDateDisplay,
    identityRevision: revision + 1,
  });

  if (value.displayName !== user.displayName) {
    const projectedPosts = await ctx.db
      .query("discoverPosts")
      .withIndex("by_authorId", (q) => q.eq("authorId", user.userId))
      .take(1);
    if (projectedPosts.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.discoverProjection.repairAuthorName,
        {
          authorId: user.userId,
          newAuthorName: value.displayName,
          paginationOpts: { numItems: DISCOVER_BATCH_SIZE, cursor: null },
        },
      );
    }
  }

  return { kind: "saved", revision: revision + 1 };
}
