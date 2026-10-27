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
import type { Doc } from "./_generated/dataModel";
import { authComponent } from "./auth";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";

function validateBookmarkPagination(options: {
  numItems: number;
  maximumRowsRead?: number;
}) {
  if (
    !Number.isSafeInteger(options.numItems) ||
    options.numItems < 1 ||
    options.numItems > 20 ||
    (options.maximumRowsRead !== undefined &&
      (!Number.isSafeInteger(options.maximumRowsRead) ||
        options.maximumRowsRead < 1 ||
        options.maximumRowsRead > 20))
  ) {
    throw new ConvexError("Page size must be a safe integer between 1 and 20.");
  }
}
import { getPublishedPost, requirePublishedPost } from "./postLifecycle";
import {
  hydratePostSummary,
  collectionPostSummaryValidator,
  type CollectionPostSummary,
} from "./postSummary";
import { usernamesForOwners } from "./usernameModel";

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
  returns: v.object({ bookmarked: v.boolean() }),
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
  returns: v.boolean(),
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
 * each post with collection data including its save time: `imageUrl`, `authorName`,
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
  returns: paginationResultValidator(collectionPostSummaryValidator),
  handler: async (ctx, args) => {
    validateBookmarkPagination(args.paginationOpts);
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

    const posts = await Promise.all(
      result.page.map(async (bookmark) => {
        const post = await ctx.db.get(bookmark.postId);
        return post && post.status === "published" ? post : null;
      }),
    );
    const usernames = await usernamesForOwners(
      ctx,
      posts
        .filter((post): post is Doc<"posts"> => post !== null)
        .map((post) => post.authorId),
    );

    const hydrated = await Promise.all(
      posts.map(async (post, index): Promise<CollectionPostSummary | null> => {
        if (!post) {
          // Dangling bookmark — post deleted. Skip it.
          return null;
        }
        return {
          ...(await hydratePostSummary(
            ctx,
            post,
            authUser._id,
            usernames.get(post.authorId) ?? null,
          )),
          addedAt: result.page[index].createdAt,
        };
      }),
    );

    return {
      ...result,
      page: hydrated.filter(
        (post): post is CollectionPostSummary => post !== null,
      ),
    };
  },
});
