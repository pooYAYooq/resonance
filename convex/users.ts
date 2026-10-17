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
import { mutation, query, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import { internal } from "./_generated/api";
import { ensureAppProfile } from "./accountProvisioning";
import { DISCOVER_BATCH_SIZE } from "./discoverProjection";
import { formatCalendarJoinedDate } from "../lib/profile-joined-date";

/**
 * Aligns Discover's denormalized author name after a profile is created.
 *
 * `syncUser` never changes display names (the author owns them), so this only
 * runs for a record that was just created. An author-initiated display-name
 * change is repaired by `saveIdentity` in `profileModel`.
 */
async function scheduleDiscoverRepairIfNeeded(
  ctx: MutationCtx,
  authorId: string,
  displayName: string,
): Promise<void> {
  const projectedPosts = await ctx.db
    .query("discoverPosts")
    .withIndex("by_authorId", (q) => q.eq("authorId", authorId))
    .take(1);
  if (projectedPosts.length === 0) return;
  // Keep Discover's denormalized author fields aligned without blocking auth sync.
  await ctx.scheduler.runAfter(
    0,
    internal.discoverProjection.repairAuthorName,
    {
      authorId,
      newAuthorName: displayName,
      paginationOpts: { numItems: DISCOVER_BATCH_SIZE, cursor: null },
    },
  );
}

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  userId: v.string(),
  displayName: v.string(),
  username: v.optional(v.string()),
  usernameLower: v.optional(v.string()),
  usernameRevision: v.optional(v.number()),
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
  welcomeDismissedAt: v.optional(v.number()),
  followerCount: v.optional(v.number()),
  followingCount: v.optional(v.number()),
  publishedPostCount: v.number(),
  unreadNotificationCount: v.number(),
  createdAt: v.number(),
});

const publicProfileValidator = v.object({
  userId: v.string(),
  displayName: v.string(),
  username: v.union(v.string(), v.null()),
  bio: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  joinedDate: v.union(v.string(), v.null()),
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
 * New accounts are provisioned by the Better Auth `user.onCreate` trigger
 * (`internal.usernames.provisionAccount`), which runs in the same transaction
 * as the auth-user insert and reserves a generated username there. This
 * mutation converges the same record through the shared `ensureAppProfile`
 * helper, so a signup that survives account creation already has a username and
 * a later sync is a no-op. The global `AuthSync` component (in
 * `components/web/AuthSync.tsx`) calls this on every sign-in, not just on pages
 * that render the Navbar.
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

    const { user, created } = await ensureAppProfile(ctx, authUser);

    if (created) {
      await scheduleDiscoverRepairIfNeeded(ctx, user.userId, user.displayName);
    }

    return user._id;
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
      username: user.username ?? null,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      joinedDate:
        user.joinedAt != null ? formatCalendarJoinedDate(user.joinedAt) : null,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      postCount: user.publishedPostCount,
      viewerId: authUser?._id ?? null,
      isFollowing,
    };
  },
});
