/**
 * Public author identity APIs.
 *
 * `getPublicIdentity` is viewer-independent and whitelists only public fields.
 * `getEditorProfile` and `updateIdentity` are authenticated and always operate
 * on the caller's own record, derived from auth rather than an argument.
 * Selection reads and writes arrive in the follow-up boundary.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import {
  authorCardValidator,
  getOwnProfile,
  identityInputValidator,
  joinDateDisplayValidator,
  revisionSaveValidator,
  saveIdentity,
  socialProfilesValidator,
  storedIdentity,
} from "./profileModel";

const publicIdentityValidator = v.object({
  userId: v.string(),
  displayName: v.string(),
  bio: v.union(v.string(), v.null()),
  avatarUrl: v.union(v.string(), v.null()),
  countryCode: v.union(v.string(), v.null()),
  socialProfiles: socialProfilesValidator,
  joinedAt: v.union(v.number(), v.null()),
  joinDateDisplay: joinDateDisplayValidator,
  followerCount: v.number(),
  followingCount: v.number(),
  postCount: v.number(),
});

const editorProfileValidator = v.object({
  userId: v.string(),
  email: v.union(v.string(), v.null()),
  avatarUrl: v.union(v.string(), v.null()),
  identity: identityInputValidator,
  joinedAt: v.union(v.number(), v.null()),
  identityRevision: v.number(),
  selectionRevision: v.number(),
  selectedPostIds: v.array(v.id("posts")),
  selectedPosts: v.array(authorCardValidator),
});

export const getPublicIdentity = query({
  args: { userId: v.string() },
  returns: v.union(publicIdentityValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getOwnProfile(ctx, args.userId);
    if (!user) return null;
    return {
      userId: user.userId,
      displayName: user.displayName,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      countryCode: user.countryCode ?? null,
      socialProfiles: user.socialProfiles ?? {},
      joinedAt: user.joinedAt ?? null,
      joinDateDisplay: user.joinDateDisplay ?? "calendar",
      followerCount: user.followerCount ?? 0,
      followingCount: user.followingCount ?? 0,
      postCount: user.publishedPostCount,
    };
  },
});

export const getEditorProfile = query({
  args: {},
  returns: v.union(editorProfileValidator, v.null()),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return null;
    const user = await getOwnProfile(ctx, authUser._id);
    if (!user) return null;
    return {
      userId: user.userId,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? null,
      identity: storedIdentity(user),
      joinedAt: user.joinedAt ?? null,
      identityRevision: user.identityRevision ?? 0,
      selectionRevision: user.selectionRevision ?? 0,
      selectedPostIds: user.selectedPostIds ?? [],
      // Selection cards are hydrated in the selected-work boundary.
      selectedPosts: [],
    };
  },
});

export const updateIdentity = mutation({
  args: {
    expectedRevision: v.number(),
    identity: identityInputValidator,
  },
  returns: revisionSaveValidator,
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new ConvexError("Unauthorized");
    const user = await getOwnProfile(ctx, authUser._id);
    if (!user) throw new ConvexError("Unauthorized");
    return await saveIdentity(ctx, user, args.expectedRevision, args.identity);
  },
});
