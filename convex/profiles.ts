/**
 * Public author identity APIs.
 *
 * `getPublicIdentity` is viewer-independent and whitelists only public fields.
 * `getEditorProfile` and `updateIdentity` are authenticated and always operate
 * on the caller's own record, derived from auth rather than an argument.
 * Selection reads and writes arrive in the follow-up boundary.
 */
import { ConvexError, v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { MAX_SELECTED_POSTS, countCodePoints } from "../lib/profile-identity";
import {
  assertPageSize,
  boundExplicitCursorRange,
  MAX_PROFILE_PAGE_SIZE,
  authorCardValidator,
  getOwnProfile,
  hydrateAuthorCards,
  identityInputValidator,
  joinDateDisplayValidator,
  readSelectedShowcase,
  readShowcase,
  revisionSaveValidator,
  saveIdentity,
  saveSelection,
  socialProfilesValidator,
  storedIdentity,
  summariesToCards,
  survivingAuthorPostIds,
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
      selectedPosts: await hydrateAuthorCards(
        ctx,
        user.userId,
        user.selectedPostIds ?? [],
      ),
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

const showcaseValidator = v.object({
  mode: v.union(v.literal("selected"), v.literal("latest")),
  posts: v.array(authorCardValidator),
});

const MAX_OWN_TITLE_SEARCH_CODE_POINTS = 100;

/** Surviving ordered selections, or the latest three published posts. */
export const getShowcase = query({
  args: { userId: v.string() },
  returns: showcaseValidator,
  handler: async (ctx, args) => await readShowcase(ctx, args.userId),
});

/**
 * The author's surviving featured selection alone, in saved order, with no
 * latest-post fallback. The public profile renders only a saved selection, so
 * it uses this read instead of hydrating a fallback it discards.
 */
export const getSelectedShowcase = query({
  args: { userId: v.string() },
  returns: v.array(authorCardValidator),
  handler: async (ctx, args) => await readSelectedShowcase(ctx, args.userId),
});

/** Newest-first published posts for one author, bounded by the native page size. */
export const listAuthorPosts = query({
  args: {
    userId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(authorCardValidator),
  handler: async (ctx, args) => {
    assertPageSize(args.paginationOpts);
    const paginationOpts = boundExplicitCursorRange(args.paginationOpts);
    const result = await ctx.db
      .query("discoverPosts")
      .withIndex("by_authorId_and_publishedAt", (q) =>
        q.eq("authorId", args.userId),
      )
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: await summariesToCards(ctx, result.page) };
  },
});

/**
 * The authenticated author's own published posts for the selection picker.
 * An empty search browses newest first; a title search is bounded and filtered
 * to the caller's own rows, then hydrated from compact summaries. Only posts
 * with stored covers are eligible. Filtering a native page can leave it empty;
 * its pagination metadata still advances to the next page. An explicit end
 * cursor range is refused: the search index ignores read budgets and cannot
 * split, so such a range would scan before it could be rejected.
 */
export const listOwnPublishedPosts = query({
  args: {
    search: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(authorCardValidator),
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new ConvexError("Unauthorized");
    assertPageSize(args.paginationOpts);
    const search = args.search.trim();
    if (countCodePoints(search) > MAX_OWN_TITLE_SEARCH_CODE_POINTS) {
      throw new ConvexError("Search is too long.");
    }
    if (search.length === 0) {
      const paginationOpts = boundExplicitCursorRange(args.paginationOpts);
      const result = await ctx.db
        .query("discoverPosts")
        .withIndex("by_authorId_and_publishedAt", (q) =>
          q.eq("authorId", authUser._id),
        )
        .order("desc")
        .paginate(paginationOpts);
      return {
        ...result,
        page: await summariesToCards(
          ctx,
          result.page.filter((summary) => Boolean(summary.imageStorageId)),
        ),
      };
    }
    // The search index ignores read budgets and cannot split, so accepting an
    // explicit end cursor would scan the whole requested range before the size
    // check below could reject it. Refuse the unsupported range up front.
    if (args.paginationOpts.endCursor != null) {
      throw new ConvexError(
        "Title search does not support an explicit end cursor range.",
      );
    }
    const result = await ctx.db
      .query("discoverPostSearch")
      .withSearchIndex("search_title_and_authorId", (q) =>
        q.search("title", search).eq("authorId", authUser._id),
      )
      .paginate(args.paginationOpts);
    if (result.page.length > MAX_PROFILE_PAGE_SIZE) {
      throw new ConvexError("Search range exceeds the maximum page size.");
    }
    const cards = [];
    for (const hit of result.page) {
      const summary = await ctx.db
        .query("discoverPosts")
        .withIndex("by_postId", (q) => q.eq("postId", hit.postId))
        .unique();
      if (
        summary &&
        summary.authorId === authUser._id &&
        summary.imageStorageId
      ) {
        cards.push(...(await summariesToCards(ctx, [summary])));
      }
    }
    return { ...result, page: cards };
  },
});

/**
 * Live availability for the current selection arguments: only the caller's own
 * currently published posts, in argument order, as IDs. Foreign, draft, and
 * missing entries are omitted without exposing their details or hydrating
 * cards and cover URLs the caller does not read.
 */
export const getOwnSelectionAvailability = query({
  args: { postIds: v.array(v.id("posts")) },
  returns: v.array(v.id("posts")),
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new ConvexError("Unauthorized");
    if (args.postIds.length > MAX_SELECTED_POSTS) {
      throw new ConvexError(`Select at most ${MAX_SELECTED_POSTS} posts.`);
    }
    if (new Set(args.postIds).size !== args.postIds.length) {
      throw new ConvexError("Selection contains duplicates.");
    }
    return await survivingAuthorPostIds(ctx, authUser._id, args.postIds);
  },
});

/** Revision-checked, ordered selection write for the caller's own posts. */
export const updateSelection = mutation({
  args: {
    expectedRevision: v.number(),
    postIds: v.array(v.id("posts")),
  },
  returns: revisionSaveValidator,
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new ConvexError("Unauthorized");
    const user = await getOwnProfile(ctx, authUser._id);
    if (!user) throw new ConvexError("Unauthorized");
    return await saveSelection(ctx, user, args.expectedRevision, args.postIds);
  },
});
