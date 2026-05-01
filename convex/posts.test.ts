/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const createStorageId = async (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => {
    return await ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])], {
      type: "image/png",
    }));
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

    await expect(t.mutation(api.posts.generateImageUploadUrl, {})).rejects.toThrow(
      "Unauthorized",
    );
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
      });

      const secondImage = await ctx.storage.store(
        new Blob([new Uint8Array([2])], { type: "image/png" }),
      );

      await ctx.db.insert("posts", {
        title: "Newer",
        body: "Newer body content.",
        authorId: "user-1",
        imageStorageId: secondImage,
      });
    });

    const posts = await t.query(api.posts.getPosts, {});
    expect(posts.map((post) => post.title)).toEqual(["Newer", "Older"]);
  });
});
