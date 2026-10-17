/**
 * The one place an app-level profile is created or refreshed from Better Auth
 * identity, shared by the account-created trigger and `users.syncUser` so both
 * paths converge on the same record and the same initial username.
 */
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getCodePointCount } from "../lib/post-content";
import {
  MAX_POST_AUTHOR_NAME_CODE_POINTS,
  truncatePostAuthorName,
} from "../lib/post-capacity";
import { ensureUsername } from "./usernameModel";

/** The Better Auth user fields provisioning reads; the doc itself is opaque. */
export type AuthUserLike = {
  _id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  createdAt?: number;
};

export type ProvisionedProfile = {
  user: Doc<"users">;
  created: boolean;
};

/** Rejects a provider display name that exceeds the stored author-name bound. */
export function validateDisplayName(displayName: string): void {
  if (getCodePointCount(displayName) > MAX_POST_AUTHOR_NAME_CODE_POINTS) {
    throw new ConvexError(
      `Display name must be ${MAX_POST_AUTHOR_NAME_CODE_POINTS} characters or fewer.`,
    );
  }
}

/** Trims and truncates a provider name, or `null` when it is empty. */
export function normalizeProviderDisplayName(
  providerName: string | null | undefined,
): string | null {
  const normalizedName = providerName?.trim();
  return normalizedName ? truncatePostAuthorName(normalizedName) : null;
}

/**
 * Creates the app-level profile for a new account, or refreshes the existing
 * one from the current provider identity, then guarantees a generated username.
 *
 * Idempotent by design: both the account-created trigger and `syncUser` call it,
 * and whichever runs second converges on the record the first one wrote. The
 * author owns their display name, so an existing record keeps it; only email,
 * provider avatar, and a missing join date are refreshed. A provider avatar
 * change advances `identityRevision` so an open editor notices the new record.
 */
export async function ensureAppProfile(
  ctx: MutationCtx,
  authUser: AuthUserLike,
): Promise<ProvisionedProfile> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
    .unique();

  if (existing) {
    const avatarChanged =
      authUser.image != null && authUser.image !== existing.avatarUrl;
    await ctx.db.patch(existing._id, {
      email: authUser.email != null ? authUser.email : existing.email,
      avatarUrl: authUser.image != null ? authUser.image : existing.avatarUrl,
      ...(existing.joinedAt === undefined &&
        typeof authUser.createdAt === "number" && {
          joinedAt: authUser.createdAt,
        }),
      ...(avatarChanged && {
        identityRevision: (existing.identityRevision ?? 0) + 1,
      }),
    });
    const refreshed = await ctx.db.get(existing._id);
    const user = await ensureUsername(ctx, refreshed ?? existing);
    return { user, created: false };
  }

  const displayName =
    normalizeProviderDisplayName(authUser.name) ?? "Anonymous";
  validateDisplayName(displayName);
  // `?? undefined` coerces `null` → `undefined` so the values align with
  // `v.optional(v.string())`, which accepts `string | undefined` but not `null`.
  const id = await ctx.db.insert("users", {
    userId: authUser._id,
    displayName,
    email: authUser.email ?? undefined,
    avatarUrl: authUser.image ?? undefined,
    bio: "",
    joinedAt:
      typeof authUser.createdAt === "number" ? authUser.createdAt : undefined,
    followerCount: 0,
    followingCount: 0,
    unreadNotificationCount: 0,
    publishedPostCount: 0,
    createdAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) {
    throw new ConvexError("Failed to create the app profile");
  }
  const user = await ensureUsername(ctx, created);
  return { user, created: true };
}
