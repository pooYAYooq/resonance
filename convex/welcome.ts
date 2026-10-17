/**
 * The one-time welcome shown after signup. Dismissal lives on the account so
 * it holds across devices, and the current username is read live so an account
 * that customized its name before dismissing never sees a stale value.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { getOwnProfile } from "./profileModel";

export const getWelcomeState = query({
  args: {},
  returns: v.union(
    v.object({
      dismissed: v.boolean(),
      username: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return null;
    const user = await getOwnProfile(ctx, authUser._id);
    if (!user) return null;
    return {
      dismissed: user.welcomeDismissedAt !== undefined,
      username: user.username ?? null,
    };
  },
});

export const dismissWelcome = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new ConvexError("Unauthorized");
    const user = await getOwnProfile(ctx, authUser._id);
    if (!user) throw new ConvexError("Unauthorized");
    if (user.welcomeDismissedAt === undefined) {
      await ctx.db.patch(user._id, { welcomeDismissedAt: Date.now() });
    }
    return null;
  },
});
