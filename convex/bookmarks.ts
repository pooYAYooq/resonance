/**
 * Convex mutations and queries for bookmarks.
 *
 * Data access: reads from and writes to the `bookmarks` table.
 * Auth: `toggleBookmark` requires a valid session via
 * `authComponent.safeGetAuthUser`; unauthenticated callers receive a
 * `ConvexError("Unauthorized")`. Queries return false / empty pages for
 * unauthenticated callers so they can mount safely in anonymous contexts.
 *
 * Mirrors `convex/likes.ts` (idempotent toggle, separate table) and
 * `convex/follows.ts` (no-arg identity, fail-soft queries). Bookmarks are
 * private, so there is no denormalized counter on `posts` or `users`.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { getPublishedPost, requirePublishedPost } from "./postLifecycle";
import {
  hydratePostSummary,
  postSummaryValidator,
  type PostSummary,
} from "./postSummary";

/**
 * Toggles a bookmark on a post for the currently authenticated user.
 *
 * If the user has already bookmarked the post, the bookmark is removed and
 * `{ bookmarked: false }` is returned. Otherwise a new bookmark is created and
 * `{ bookmarked: true }` is returned.
 *
 * @param args.postId - `Id<"posts">`: the document ID of the target post.
 * @returns `{ bookmarked: boolean }`: whether the post is now bookmarked.
 * @throws `ConvexError("Unauthorized")` if the caller has no valid session.
 * @throws `ConvexError("Post not found.")` if the post does not exist.
 */
export const toggleBookmark = mutation({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Unauthorized");
    }

    await requirePublishedPost(ctx, args.postId);

    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_and_postId", (q) =>
        q.eq("userId", user._id).eq("postId", args.postId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { bookmarked: false };
    }

    await ctx.db.insert("bookmarks", {
      userId: user._id,
      postId: args.postId,
      createdAt: Date.now(),
    });
    return { bookmarked: true };
  },
});

/**
 * Reports whether the currently authenticated user has bookmarked the given
 * post. Returns `false` when the caller is unauthenticated (no identity to
 * probe), so the bookmark button can mount safely in anonymous contexts and
 * simply render its "Save" label without first checking auth on the client.
 *
 * @param args.postId - `Id<"posts">`: the document ID of the target post.
 * @returns `boolean` — `true` if the caller is authenticated and has bookmarked
 *   the post, `false` otherwise.
 */
export const isBookmarked = query({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return false;
    }
    if (!(await getPublishedPost(ctx, args.postId))) {
      return false;
    }

    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_and_postId", (q) =>
        q.eq("userId", authUser._id).eq("postId", args.postId),
      )
      .unique();

    return !!existing;
  },
});

/**
 * Returns the current user's bookmarked posts, most-recently-saved first.
 *
 * Paginates the `bookmarks` table by the authenticated user ID, then hydrates
 * each post with the same data `PostCard` expects: `imageUrl`, `authorName`,
 * `authorAvatarUrl`, and `isLiked`. Bookmarks pointing to deleted posts are
 * skipped defensively.
 *
 * Unauthenticated callers receive an empty, done page. This is a fail-soft
 * guard (the `/reading-list` page redirects them before they get here).
 *
 * @param args.paginationOpts - `PaginationOptions`: Convex pagination config.
 * @returns `PaginationResult` of hydrated posts.
 */
export const getBookmarkedPosts = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(postSummaryValidator),
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      // Fail-soft empty page for anonymous callers.
      return { page: [], isDone: true, continueCursor: "" };
    }

    const result = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", authUser._id))
      .order("desc")
      .paginate(args.paginationOpts);

    const hydrated = await Promise.all(
      result.page.map(async (bookmark): Promise<PostSummary | null> => {
        const post = await ctx.db.get(bookmark.postId);
        if (!post || post.status !== "published") {
          // Dangling bookmark — post deleted. Skip it.
          return null;
        }
        return await hydratePostSummary(ctx, post, authUser._id);
      }),
    );

    return {
      ...result,
      page: hydrated.filter((post): post is PostSummary => post !== null),
    };
  },
});
