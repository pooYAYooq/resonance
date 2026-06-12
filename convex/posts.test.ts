/**
 * Unit tests for Convex post queries and mutations.
 * Covers auth rejection, pagination, image URL resolution, and comment counting.
 */

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * Stores a minimal PNG blob in Convex test storage and returns its ID.
 *
 * @param t - `ReturnType<typeof convexTest>`: the convex test runner instance.
 * @returns `Promise<Id<"_storage">>`: the generated storage document ID.
 */
const createStorageId = async (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => {
    return await ctx.storage.store(
      new Blob([new Uint8Array([1, 2, 3])], {
        type: "image/png",
      }),
    );
  });

describe("posts functions", () => {
  it("rejects createPost when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const imageStorageId = await createStorageId(t);

    await expect(
      t.mutation(api.posts.createPost, {
        title: "My title",
        body: "This is post body content.",
        imageStorageId,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects upload URL generation when unauthenticated", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.posts.generateImageUploadUrl, {}),
    ).rejects.toThrow("Unauthorized");
  });

  it("returns posts in descending creation order", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const firstImage = await ctx.storage.store(
        new Blob([new Uint8Array([1])], { type: "image/png" }),
      );

      await ctx.db.insert("posts", {
        title: "Older",
        body: "Older body content.",
        authorId: "user-1",
        imageStorageId: firstImage,
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const secondImage = await ctx.storage.store(
        new Blob([new Uint8Array([2])], { type: "image/png" }),
      );

      await ctx.db.insert("posts", {
        title: "Newer",
        body: "Newer body content.",
        authorId: "user-1",
        imageStorageId: secondImage,
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page.map((post) => post.title)).toEqual(["Newer", "Older"]);
  });

  it("returns null when post does not exist", async () => {
    const t = convexTest(schema, modules);

    const deletedId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "To be deleted",
        body: "Body content.",
        authorId: "user-1",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    const result = await t.query(api.posts.getPostById, {
      postId: deletedId,
    });

    expect(result).toBeNull();
  });

  it("returns post with resolved imageUrl when post has an image", async () => {
    const t = convexTest(schema, modules);

    const insertedId = await t.run(async (ctx) => {
      const imageStorageId = await ctx.storage.store(
        new Blob([new Uint8Array([1])], { type: "image/png" }),
      );

      return await ctx.db.insert("posts", {
        title: "Post with image",
        body: "Body content.",
        authorId: "user-1",
        imageStorageId,
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostById, {
      postId: insertedId,
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Post with image");
    expect(result?.imageUrl).toBeTruthy();
    expect(typeof result?.imageUrl).toBe("string");
  });

  it("returns post with null imageUrl when post has no image", async () => {
    const t = convexTest(schema, modules);

    const insertedId = await t.run(async (ctx) => {
      return await ctx.db.insert("posts", {
        title: "Post without image",
        body: "Body content.",
        authorId: "user-1",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostById, {
      postId: insertedId,
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Post without image");
    expect(result?.imageUrl).toBeNull();
  });

  it("returns commentCount in getPosts", async () => {
    const t = convexTest(schema, modules);

    const postId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        title: "Post with comments",
        body: "Body.",
        authorId: "user-1",
        commentCount: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return id;
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    const found = result.page.find((p) => p._id === postId);
    expect(found).toBeDefined();
    expect(found?.commentCount).toBe(2);
  });

  it("hydrates author name and avatar in getPosts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "user-1",
        displayName: "Bob",
        avatarUrl: "https://example.com/bob.png",
        createdAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Bob's post",
        body: "Body.",
        authorId: "user-1",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page[0].authorName).toBe("Bob");
    expect(result.page[0].authorAvatarUrl).toBe("https://example.com/bob.png");
  });

  it("returns null authorAvatarUrl in getPosts when user has no users record", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "Ghost post",
        body: "Body.",
        authorId: "unknown-user",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPosts, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page[0].authorAvatarUrl).toBeNull();
  });

  it("returns total post count via countPosts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "First",
        body: "Body one.",
        authorId: "user-1",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Second",
        body: "Body two.",
        authorId: "user-2",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Third",
        body: "Body three.",
        authorId: "user-1",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stats", { totalPosts: 3 });
    });

    const count = await t.query(api.posts.countPosts, {});
    expect(count).toBe(3);
  });

  it("returns zero from countPosts when no posts exist", async () => {
    const t = convexTest(schema, modules);

    const count = await t.query(api.posts.countPosts, {});
    expect(count).toBe(0);
  });

  it("returns only the specified author's posts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "First",
        body: "Body one.",
        authorId: "alice",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Second",
        body: "Body two.",
        authorId: "bob",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Third",
        body: "Body three.",
        authorId: "alice",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stats", { totalPosts: 3 });
    });

    const posts = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "alice",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(posts.page.length).toBe(2);
    expect(posts.page[0].title).toBe("Third");
    expect(posts.page[1].title).toBe("First");
  });

  it("pagination works", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("posts", {
          title: `Post ${i}`,
          body: "Body.",
          authorId: "alice",
          commentCount: 0,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        });
      }
    });

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "alice",
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(result.page).toHaveLength(2);
    expect(result.isDone).toBe(false);
    expect(result.continueCursor).toBeDefined();
  });

  it("hydrates author name and avatar from users table", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "alice",
        displayName: "Alice",
        avatarUrl: "https://example.com/alice.png",
        createdAt: Date.now(),
      });
      await ctx.db.insert("posts", {
        title: "Alice's post",
        body: "Body.",
        authorId: "alice",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "alice",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].authorName).toBe("Alice");
    expect(result.page[0].authorAvatarUrl).toBe("https://example.com/alice.png");
  });

  it("returns null authorAvatarUrl when user has no users record", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("posts", {
        title: "Ghost post",
        body: "Body.",
        authorId: "unknown-user",
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "unknown-user",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].authorAvatarUrl).toBeNull();
  });

  it("returns empty page for author with no posts", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.posts.getPostsByAuthorId, {
      authorId: "nobody",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });
});
