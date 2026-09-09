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

function validateDisplayName(displayName: string): void {
  if (getCodePointCount(displayName) > MAX_POST_AUTHOR_NAME_CODE_POINTS) {
    throw new ConvexError(
      `Display name must be ${MAX_POST_AUTHOR_NAME_CODE_POINTS} characters or fewer.`,
    );
  }
}

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  userId: v.string(),
  displayName: v.string(),
  email: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  bio: v.optional(v.string()),
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
      // Update fields that might have changed (name, avatar from OAuth).
      // Better Auth returns `string | null | undefined` for optional fields;
      // we only overwrite when a new non-null value is present, otherwise
      // we preserve the existing record to avoid accidentally clearing data.
      const displayName = authUser.name
        ? truncatePostAuthorName(authUser.name)
        : existing.displayName;
      validateDisplayName(displayName);
      await ctx.db.patch(existing._id, {
        displayName,
        email: authUser.email != null ? authUser.email : existing.email,
        avatarUrl: authUser.image != null ? authUser.image : existing.avatarUrl,
      });
      if (displayName !== existing.displayName) {
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
      }
      return existing._id;
    }

    // Create new user record
    // `?? undefined` coerces `null` → `undefined` so the value aligns with
    // `v.optional(v.string())`, which accepts `string | undefined` but not `null`.
    const displayName = authUser.name
      ? truncatePostAuthorName(authUser.name)
      : "Anonymous";
    validateDisplayName(displayName);
    const userId = await ctx.db.insert("users", {
      userId: authUser._id,
      displayName,
      email: authUser.email ?? undefined,
      avatarUrl: authUser.image ?? undefined,
      bio: "",
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
 * Requires an authenticated session. Validates that `displayName` is
 * non-empty after trimming and that `bio` does not exceed 160 characters.
 * Patches the existing user record rather than replacing it, so fields
 * like `email` and `avatarUrl` are preserved.
 *
 * @param args.displayName - `string`: New display name (trimmed, must be non-empty).
 * @param args.bio - `string`: New bio (max 160 characters).
 * @returns `Id<"users">`, the document ID of the updated user record.
 * @throws `ConvexError("Unauthorized")` if no valid session exists.
 * @throws `ConvexError("Display name cannot be empty.")` if trimmed name is blank.
 * @throws `ConvexError("Bio must be 160 characters or fewer.")` if bio exceeds limit.
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

    const displayName = args.displayName.trim();
    if (!displayName) {
      throw new ConvexError("Display name cannot be empty.");
    }

    if (args.bio.length > 160) {
      throw new ConvexError("Bio must be 160 characters or fewer.");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
      .unique();

    if (!existing) {
      throw new ConvexError("User not found");
    }

    validateDisplayName(displayName);
    await ctx.db.patch(existing._id, {
      displayName,
      bio: args.bio,
    });
    if (displayName !== existing.displayName) {
      // The profile is the source event; repair denormalized Discover authors asynchronously.
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

    return existing._id;
  },
});
