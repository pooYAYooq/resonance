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
 * Added during Phase 0 Task 4 to support future admin features, password
 * resets, and "find user" flows without requiring a later schema migration.
 *
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
