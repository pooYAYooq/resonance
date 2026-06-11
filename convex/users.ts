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
      await ctx.db.patch(existing._id, {
        displayName: authUser.name || existing.displayName,
        email: authUser.email != null ? authUser.email : existing.email,
        avatarUrl: authUser.image != null ? authUser.image : existing.avatarUrl,
      });
      return existing._id;
    }

    // Create new user record
    // `?? undefined` coerces `null` → `undefined` so the value aligns with
    // `v.optional(v.string())`, which accepts `string | undefined` but not `null`.
    const userId = await ctx.db.insert("users", {
      userId: authUser._id,
      displayName: authUser.name || "Anonymous",
      email: authUser.email ?? undefined,
      avatarUrl: authUser.image ?? undefined,
      bio: "",
      createdAt: Date.now(),
    });

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
 * Get a user by their app-level Convex document ID.
 *
 * Used when you already have the `users._id` (e.g. from a foreign key or
 * query result) and need the full profile.
 */
export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get a user by their Better Auth user ID (string).
 *
 * Used for cross-referencing auth identity with app-level records,
 * primarily in `syncUser` and admin lookups.
 */
export const getUserByAuthId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

/**
 * Get a user by their email address.
 *
 * Supports admin lookups, password resets, and "find user" flows.
 * Relies on the `by_email` index on the `users` table.
 *
 * @param args.email - `string`: Exact email address to search for.
 * @returns The user record or `null` if no matching email exists.
 */
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

/**
 * Gets a user's public profile including their post count.
 *
 * Looks up the user by their Better Auth user ID and returns the profile
 * enriched with the number of published posts. Returns `null` when no
 * matching user is found.
 *
 * @param args.userId - `string`: Better Auth user ID to look up.
 * @returns The user record with an appended `postCount` field, or `null`
 *   if no user matches the given ID.
 */
export const getUserProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) return null;

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("authorId", args.userId))
      .collect();

    return { ...user, postCount: posts.length };
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

    await ctx.db.patch(existing._id, {
      displayName,
      bio: args.bio,
    });

    return existing._id;
  },
});
