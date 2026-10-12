/**
 * User queries and mutations.
 * Manages the app-level `users` table, synced from Better Auth identity.
 *
 * Why a separate users table?
 * Better Auth stores auth identity (subject, email, name), but this table
 * lets us attach app-specific profile fields (bio, avatarUrl, displayName)
 * and query users by those fields without coupling to auth internals.
 *
 * All functions derive identity server-side via `authComponent.safeGetAuthUser`
 * rather than accepting user IDs as arguments — this prevents callers from
 * impersonating other users.
 */
import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import { internal } from "./_generated/api";
import { DISCOVER_BATCH_SIZE } from "./discoverProjection";
import { getCodePointCount } from "../lib/post-content";
import {
  MAX_POST_AUTHOR_NAME_CODE_POINTS,
  truncatePostAuthorName,
} from "../lib/post-capacity";
import { getOwnProfile, saveIdentity, storedIdentity } from "./profileModel";

function validateDisplayName(displayName: string): void {
  if (getCodePointCount(displayName) > MAX_POST_AUTHOR_NAME_CODE_POINTS) {
    throw new ConvexError(
      `Display name must be ${MAX_POST_AUTHOR_NAME_CODE_POINTS} characters or fewer.`,
    );
  }
}

function normalizeProviderDisplayName(
  providerName: string | null | undefined,
): string | null {
  const normalizedName = providerName?.trim();
  return normalizedName ? truncatePostAuthorName(normalizedName) : null;
}

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  userId: v.string(),
  displayName: v.string(),
  email: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  bio: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  socialProfiles: v.optional(
    v.object({
      instagram: v.optional(v.string()),
      linkedin: v.optional(v.string()),
      behance: v.optional(v.string()),
      youtube: v.optional(v.string()),
      x: v.optional(v.string()),
    }),
  ),
  joinedAt: v.optional(v.number()),
  joinDateDisplay: v.optional(
    v.union(v.literal("calendar"), v.literal("relative")),
  ),
  selectedPostIds: v.optional(v.array(v.id("posts"))),
  identityRevision: v.optional(v.number()),
  selectionRevision: v.optional(v.number()),
  followerCount: v.optional(v.number()),
  followingCount: v.optional(v.number()),
  publishedPostCount: v.number(),
  unreadNotificationCount: v.number(),
  createdAt: v.number(),
});

const publicProfileValidator = v.object({
  userId: v.string(),
  displayName: v.string(),
  bio: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  followerCount: v.optional(v.number()),
  followingCount: v.optional(v.number()),
  postCount: v.number(),
  viewerId: v.union(v.string(), v.null()),
  isFollowing: v.boolean(),
});

/**
 * Idempotent upsert: creates or updates the app-level user record
 * from the current Better Auth session.
 *
 * Call this after every sign-in (OAuth or email/password) to ensure
 * the `users` table stays in sync with auth state. The mutation is
 * idempotent — calling it multiple times for the same user is safe.
 *
 * Why not a hook or trigger? Better Auth inside Convex does not expose
 * post-signup hooks, so the client must explicitly call syncUser after
 * auth state changes. The global `AuthSync` component (in
 * `components/web/AuthSync.tsx`) handles this via useEffect so it fires
 * on every page, not just pages that render the Navbar.
 *
 * @returns `Id<"users">` — the Convex document ID of the upserted user.
 * @throws `ConvexError("Unauthorized")` if no valid session exists.
 */
export const syncUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      throw new ConvexError("Unauthorized");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
      .unique();

    if (existing) {
      // The author owns their display name, so auth sync never overwrites it.
      // Email and provider avatar stay synced; a provider avatar change
      // advances identityRevision so an open editor detects the new record.
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
      return existing._id;
    }

    // Create new user record
    // `?? undefined` coerces `null` → `undefined` so the value aligns with
    // `v.optional(v.string())`, which accepts `string | undefined` but not `null`.
    const displayName =
      normalizeProviderDisplayName(authUser.name) ?? "Anonymous";
    validateDisplayName(displayName);
    const userId = await ctx.db.insert("users", {
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

    const projectedPosts = await ctx.db
      .query("discoverPosts")
      .withIndex("by_authorId", (q) => q.eq("authorId", authUser._id))
      .take(1);
    if (projectedPosts.length > 0) {
      // Keep Discover's denormalized author fields aligned without blocking auth sync.
      await ctx.scheduler.runAfter(
        0,
        internal.discoverProjection.repairAuthorName,
        {
          authorId: authUser._id,
          newAuthorName: displayName,
          paginationOpts: { numItems: DISCOVER_BATCH_SIZE, cursor: null },
        },
      );
    }

    return userId;
  },
});

/**
 * Get the app-level user record for the currently authenticated session.
 *
 * Returns `null` when unauthenticated. This is the primary query for
 * Navbar and profile pages to resolve the current user's app-level profile.
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
      .unique();
  },
});

/**
 * Gets a user's public profile including their post count.
 *
 * Looks up the user by their Better Auth user ID and returns the profile
 * enriched with the maintained number of published posts. Returns `null` when
 * no matching user is found.
 *
 * @param args.userId - `string`: Better Auth user ID to look up.
 * @returns The user record with an appended `postCount` field, or
 *   `null` if no user matches the given ID.
 */
export const getUserProfile = query({
  args: { userId: v.string() },
  returns: v.union(publicProfileValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) return null;

    const authUser = await authComponent.safeGetAuthUser(ctx);
    const isFollowing = authUser
      ? !!(await ctx.db
          .query("follows")
          .withIndex("by_followerId_and_followingId", (q) =>
            q.eq("followerId", authUser._id).eq("followingId", args.userId),
          )
          .unique())
      : false;

    return {
      userId: user.userId,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      postCount: user.publishedPostCount,
      viewerId: authUser?._id ?? null,
      isFollowing,
    };
  },
});

/**
 * Updates the current user's display name and bio.
 *
 * A temporary adapter for the still-reachable legacy editor: it writes through
 * the shared revision-checked identity helper at the record's current
 * revision, so the new identity fields are preserved and `identityRevision`
 * advances. Requires an authenticated session; the display name is validated
 * by the shared normalizer and the bio uses the shared 1,000-code-point limit.
 *
 * @param args.displayName - `string`: New display name (trimmed, must be non-empty).
 * @param args.bio - `string`: New bio (shared code-point limit).
 * @returns `Id<"users">`, the document ID of the updated user record.
 * @throws `ConvexError("Unauthorized")` if no valid session exists.
 * @throws `ConvexError` with the shared normalizer message for an invalid field.
 * @throws `ConvexError("User not found")` if the authenticated user has no record.
 */
export const updateProfile = mutation({
  args: {
    displayName: v.string(),
    bio: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      throw new ConvexError("Unauthorized");
    }

    const existing = await getOwnProfile(ctx, authUser._id);
    if (!existing) {
      throw new ConvexError("User not found");
    }

    // Temporary adapter for the still-reachable old editor: it writes through
    // the shared revision-checked helper at the current revision, preserving
    // the new identity fields. The follow-up boundary retires this entry point.
    const result = await saveIdentity(
      ctx,
      existing,
      existing.identityRevision ?? 0,
      {
        ...storedIdentity(existing),
        displayName: args.displayName,
        bio: args.bio,
      },
    );
    if (result.kind !== "saved") {
      throw new ConvexError("Profile changed. Reload and try again.");
    }

    return existing._id;
  },
});
