/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/better-auth/test";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  register(t);
  const ids = await t.run(async (ctx) => {
    const postId = await ctx.db.insert("posts", {
      title: "A conversation",
      body: "Article",
      tags: [],
      authorId: "author",
      status: "published",
      publishedAt: 1,
      commentCount: 65,
      likeCount: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    const comments = [];
    for (let i = 0; i < 65; i++)
      comments.push(
        await ctx.db.insert("comments", {
          postId,
          authorId: "reader",
          authorName: "Reader",
          body: `Comment ${i}`,
          likeCount: 0,
          createdAt: i,
        }),
      );
    return { postId, comments };
  });
  return { t, ...ids };
}

describe("focused comment destination", () => {
  it("returns the public conversation and bounded nearby comments without an identity", async () => {
    const { t, postId, comments } = await fixture();
    const result = await t.query(api.comments.getCommentDestination, {
      postId,
      commentId: comments[10],
    });
    expect(result?.post.title).toBe("A conversation");
    expect(result?.comment?._id).toBe(comments[10]);
    expect(result?.nearby).toHaveLength(8);
    expect(result?.nearby.map((c) => c.body)).toEqual([
      "Comment 6",
      "Comment 7",
      "Comment 8",
      "Comment 9",
      "Comment 11",
      "Comment 12",
      "Comment 13",
      "Comment 14",
    ]);
    expect(result?.comment?.isLiked).toBe(false);
    expect(result?.nearby.every((comment) => comment.isLiked === false)).toBe(
      true,
    );
  });
  it("returns a missing-comment state without exposing a different post's comment", async () => {
    const { t, postId, comments } = await fixture();
    const otherPost = await t.run(async (ctx) => {
      const post = await ctx.db.get(postId);
      const { _id, _creationTime, ...fields } = post!;
      void _id;
      void _creationTime;
      return ctx.db.insert("posts", fields);
    });
    const result = await t.query(api.comments.getCommentDestination, {
      postId: otherPost,
      commentId: comments[0],
    });
    expect(result?.comment).toBeNull();
    expect(result?.nearby).toEqual([]);
    await t.run((ctx) => ctx.db.delete(comments[0]));
    expect(
      (
        await t.query(api.comments.getCommentDestination, {
          postId,
          commentId: comments[0],
        })
      )?.comment,
    ).toBeNull();
  });
  it("hides draft and deleted posts", async () => {
    const { t, postId, comments } = await fixture();
    await t.run((ctx) => ctx.db.patch(postId, { status: "draft" }));
    expect(
      await t.query(api.comments.getCommentDestination, {
        postId,
        commentId: comments[0],
      }),
    ).toBeNull();
    await t.run((ctx) => ctx.db.delete(postId));
    expect(
      await t.query(api.comments.getCommentDestination, {
        postId,
        commentId: comments[0],
      }),
    ).toBeNull();
  });
});

async function createAuthenticatedTestUser(
  t: ReturnType<typeof convexTest>,
  email: string,
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Commenter",
          email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            userId: user._id,
            token: `session-${email}`,
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
}

it("returns viewer-specific likes and accepts malformed deep links safely", async () => {
  const { t, postId, comments } = await fixture();
  const identity = await createAuthenticatedTestUser(
    t,
    "focused-comments@example.test",
  );
  await t.run((ctx) =>
    ctx.db.insert("commentLikes", {
      commentId: comments[0],
      userId: identity.subject,
      createdAt: 1,
    }),
  );
  expect(
    (
      await t.withIdentity(identity).query(api.comments.getCommentDestination, {
        postId,
        commentId: comments[0],
      })
    )?.comment?.isLiked,
  ).toBe(true);
  expect(
    (
      await t.query(api.comments.getCommentDestination, {
        postId,
        commentId: comments[0],
      })
    )?.comment?.isLiked,
  ).toBe(false);
  expect(
    await t.query(api.comments.getCommentDestination, {
      postId: "invalid",
      commentId: "invalid",
    }),
  ).toBeNull();
  expect(
    (
      await t.query(api.comments.getCommentDestination, {
        postId,
        commentId: "invalid",
      })
    )?.comment,
  ).toBeNull();
});
