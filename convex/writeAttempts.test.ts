/// <reference types="vite/client" />

import { register } from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const proposal = {
  title: "A considered title",
  body: JSON.stringify({
    format: "blocknote@1",
    blocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "A considered body." }],
      },
    ],
  }),
  tags: ["Technology"],
};

afterEach(() => vi.useRealTimers());

function assertSucceeded<
  T extends
    | { kind: "succeeded"; postId: string; updatedAt: number; status: string }
    | { kind: "failed"; category: string; message: string },
>(result: T): Extract<T, { kind: "succeeded" }> {
  if (result.kind !== "succeeded") throw new Error(result.message);
  return result as Extract<T, { kind: "succeeded" }>;
}

it("rejects write-attempt reservations without an authenticated author", async () => {
  const t = convexTest(schema, modules);

  await expect(
    t.mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "request-1",
      operationKind: "save-draft",
      proposal,
    }),
  ).rejects.toThrow("Unauthorized");
});

it("reserves an immutable author-bound request", async () => {
  const t = convexTest(schema, modules);
  register(t);
  const now = Date.now();
  const identity = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Writing author",
          email: "writing-author@example.com",
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
            token: "writing-session",
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });

  await t.withIdentity(identity).mutation(api.users.syncUser, {});

  const result = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "request-1",
      operationKind: "save-draft",
      proposal,
    });

  expect(result.attemptId).toBeDefined();
  expect(result.expiresAt).toBeGreaterThan(now);
  await expect(
    t.run(async (ctx) => ctx.db.get(result.attemptId)),
  ).resolves.toMatchObject({
    clientRequestId: "request-1",
    operationKind: "save-draft",
    userId: identity.subject,
  });

  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "request-1",
      operationKind: "save-draft",
      proposal,
    }),
  ).resolves.toEqual(result);

  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "request-1",
      operationKind: "save-draft",
      proposal: { ...proposal, title: "Changed proposal" },
    }),
  ).rejects.toThrow("Request binding mismatch");

  const foreignPostId = await t.run(async (ctx) =>
    ctx.db.insert("posts", {
      title: "Foreign post",
      body: proposal.body,
      tags: proposal.tags,
      authorId: "another-account",
      status: "draft",
      commentCount: 0,
      likeCount: 0,
      uniqueViewCount: 0,
      createdAt: now,
      updatedAt: now,
    }),
  );
  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "foreign-target",
      operationKind: "update-post",
      postId: foreignPostId,
      expectedUpdatedAt: now,
      proposal,
    }),
  ).rejects.toThrow("Write target not found");
});

it("executes a reserved draft save once and replays its result", async () => {
  const t = convexTest(schema, modules);
  register(t);
  const now = Date.now();
  const identity = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Draft author",
          email: "draft-author@example.com",
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
            token: "draft-write-session",
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  await t.withIdentity(identity).mutation(api.users.syncUser, {});

  const draftId = await t.run(async (ctx) =>
    ctx.db.insert("posts", {
      title: "Original title",
      body: proposal.body,
      tags: proposal.tags,
      authorId: identity.subject,
      status: "draft",
      commentCount: 0,
      likeCount: 0,
      uniqueViewCount: 0,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const nextProposal = { ...proposal, title: "Saved title" };
  const reservation = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "draft-save-1",
      operationKind: "save-draft",
      postId: draftId,
      expectedUpdatedAt: 1,
      proposal: nextProposal,
    });

  const result = assertSucceeded(
    await t.withIdentity(identity).mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal: nextProposal,
    }),
  );
  expect(result).toMatchObject({
    postId: draftId,
    status: "draft",
  });

  await expect(
    t.run(async (ctx) => ctx.db.get(draftId)),
  ).resolves.toMatchObject({
    title: "Saved title",
    updatedAt: result.updatedAt,
  });
  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal: nextProposal,
    }),
  ).resolves.toEqual(result);
  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal: { ...nextProposal, title: "Tampered title" },
    }),
  ).rejects.toThrow("Request binding mismatch");
});

it("hides an attempt from a different author during execution", async () => {
  const t = convexTest(schema, modules);
  register(t);
  const now = Date.now();
  const createIdentity = async (email: string) =>
    t.run(async (ctx) => {
      const user = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "user",
          data: {
            name: email,
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
              token: `${email}-session`,
              expiresAt: now + 60_000,
              createdAt: now,
              updatedAt: now,
            },
          },
        },
      );
      return { subject: user._id, sessionId: session._id };
    });
  const author = await createIdentity("author-a@example.com");
  const otherAuthor = await createIdentity("author-b@example.com");
  await t.withIdentity(author).mutation(api.users.syncUser, {});
  await t.withIdentity(otherAuthor).mutation(api.users.syncUser, {});
  const reservation = await t
    .withIdentity(author)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "author-a-request",
      operationKind: "save-draft",
      proposal,
    });

  await expect(
    t.withIdentity(otherAuthor).mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal,
    }),
  ).rejects.toThrow("Write attempt not found");
});

it("retains expired outcomes for reconciliation before bounded cleanup", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T00:00:00.000Z"));
  const t = convexTest(schema, modules);
  register(t);
  const now = Date.now();
  const identity = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Retention author",
          email: "retention@example.com",
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
            token: "retention-session",
            expiresAt: now + 14 * 24 * 60 * 60 * 1000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  await t.withIdentity(identity).mutation(api.users.syncUser, {});
  const reservation = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "retained-failure",
      operationKind: "save-draft",
      proposal: { ...proposal, body: "invalid" },
    });
  const invalidProposal = { ...proposal, body: "invalid" };
  const failed = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal: invalidProposal,
    });

  vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal: invalidProposal,
    }),
  ).rejects.toThrow("Write attempt expired");
  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.reconcileAttempt, {
      attemptId: reservation.attemptId,
      proposal: invalidProposal,
    }),
  ).resolves.toEqual(failed);

  vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);
  await t.mutation(internal.writeAttempts.cleanupExpired, { cursor: null });
  await expect(
    t.run(async (ctx) => ctx.db.get(reservation.attemptId)),
  ).resolves.toBeNull();
});

it("persists and replays deterministic validation failures after expiry", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
  const t = convexTest(schema, modules);
  register(t);
  const now = Date.now();
  const identity = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Failure author",
          email: "failure-author@example.com",
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
            token: "failure-session",
            expiresAt: now + 48 * 60 * 60 * 1000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  await t.withIdentity(identity).mutation(api.users.syncUser, {});
  const draftId = await t.run(async (ctx) =>
    ctx.db.insert("posts", {
      title: "Original draft",
      body: proposal.body,
      tags: proposal.tags,
      authorId: identity.subject,
      status: "draft",
      commentCount: 0,
      likeCount: 0,
      uniqueViewCount: 0,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const invalidProposal = {
    ...proposal,
    body: JSON.stringify({
      format: "blocknote@1",
      blocks: [
        {
          type: "image",
          props: {
            storageId: "image-1",
            altText: "x".repeat(1_001),
          },
        },
      ],
    }),
  };
  const reservation = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "invalid-proposal-request",
      operationKind: "update-post",
      postId: draftId,
      expectedUpdatedAt: 1,
      proposal: invalidProposal,
    });

  const failed = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal: invalidProposal,
    });
  expect(failed).toEqual({
    kind: "failed",
    category: "capacity",
    message: "Image alt text is too long.",
  });
  await expect(
    t.run(async (ctx) => ctx.db.get(draftId)),
  ).resolves.toMatchObject({
    title: "Original draft",
    body: proposal.body,
    updatedAt: 1,
  });
  await expect(
    t.run(async (ctx) => ctx.db.get(reservation.attemptId)),
  ).resolves.toMatchObject({ outcome: failed });

  vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.reconcileAttempt, {
      attemptId: reservation.attemptId,
      proposal: invalidProposal,
    }),
  ).resolves.toEqual(failed);
});

it("rolls back unexpected projection failures without recording a failure", async () => {
  const t = convexTest(schema, modules);
  register(t);
  const now = Date.now();
  const identity = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "System failure author",
          email: "system-failure@example.com",
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
            token: "system-failure-session",
            expiresAt: now + 60 * 60 * 1000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  await t.withIdentity(identity).mutation(api.users.syncUser, {});
  const postId = await t.run(async (ctx) => {
    const postId = await ctx.db.insert("posts", {
      title: "Original title",
      body: proposal.body,
      tags: ["Technology"],
      authorId: identity.subject,
      status: "published",
      publishedAt: now,
      commentCount: 0,
      likeCount: 0,
      uniqueViewCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("discoverPostTopics", {
      tag: "Technology",
      postId,
      publishedAt: now,
    });
    await ctx.db.insert("discoverPostTopics", {
      tag: "Technology",
      postId,
      publishedAt: now,
    });
    return postId;
  });
  const updateProposal = { ...proposal, title: "Updated title" };
  const reservation = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "unexpected-failure-request",
      operationKind: "update-post",
      postId,
      expectedUpdatedAt: now,
      proposal: updateProposal,
    });

  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal: updateProposal,
    }),
  ).rejects.toThrow("Duplicate topic rows");
  await expect(t.run(async (ctx) => ctx.db.get(postId))).resolves.toMatchObject(
    {
      title: "Original title",
      updatedAt: now,
    },
  );
  const attempt = await t.run(async (ctx) => ctx.db.get(reservation.attemptId));
  expect(attempt?.outcome).toBeUndefined();
});

it("publishes a reserved proposal and applies a versioned published update", async () => {
  const t = convexTest(schema, modules);
  register(t);
  const now = Date.now();
  const identity = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Publisher",
          email: "publisher-write@example.com",
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
            token: "publisher-write-session",
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  await t.withIdentity(identity).mutation(api.users.syncUser, {});

  const publishedProposal = {
    ...proposal,
    title: "Published title",
    body: JSON.stringify({
      format: "blocknote@1",
      blocks: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This publication has enough readable content.",
            },
          ],
        },
      ],
    }),
  };
  const publication = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "publish-1",
      operationKind: "publish",
      proposal: publishedProposal,
    });
  const published = assertSucceeded(
    await t.withIdentity(identity).mutation(api.writeAttempts.executeAttempt, {
      attemptId: publication.attemptId,
      proposal: publishedProposal,
    }),
  );
  expect(published.status).toBe("published");

  const updateProposal = { ...publishedProposal, title: "Updated title" };
  const update = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "update-1",
      operationKind: "update-post",
      postId: published.postId,
      expectedUpdatedAt: published.updatedAt,
      proposal: updateProposal,
    });
  const updated = assertSucceeded(
    await t.withIdentity(identity).mutation(api.writeAttempts.executeAttempt, {
      attemptId: update.attemptId,
      proposal: updateProposal,
    }),
  );

  expect(updated.updatedAt).toBeGreaterThan(published.updatedAt);
  await expect(
    t.run(async (ctx) => ctx.db.get(published.postId)),
  ).resolves.toMatchObject({
    title: "Updated title",
    status: "published",
    updatedAt: updated.updatedAt,
  });
});

it("returns indeterminate after an expired attempt lacks authoritative evidence", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
  const t = convexTest(schema, modules);
  register(t);
  const now = Date.now();
  const identity = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Uncertain author",
          email: "uncertain-author@example.com",
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
            token: "uncertain-session",
            expiresAt: now + 48 * 60 * 60 * 1000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  await t.withIdentity(identity).mutation(api.users.syncUser, {});

  const reservation = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "uncertain-request",
      operationKind: "save-draft",
      proposal,
    });
  vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.reconcileAttempt, {
      attemptId: reservation.attemptId,
      proposal,
    }),
  ).resolves.toEqual({
    kind: "indeterminate",
    message:
      "The write may have succeeded, but no authoritative result remains.",
  });

  await expect(
    t.run(async (ctx) => ctx.db.get(reservation.attemptId)),
  ).resolves.toMatchObject({
    outcome: {
      kind: "indeterminate",
    },
  });

  await expect(
    t.withIdentity(identity).mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "uncertain-request",
      operationKind: "save-draft",
      proposal,
    }),
  ).resolves.toMatchObject({ attemptId: reservation.attemptId });

  const acknowledgedNewAction = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "acknowledged-new-request",
      operationKind: "save-draft",
      proposal,
    });
  expect(acknowledgedNewAction.attemptId).not.toBe(reservation.attemptId);
});

it("publishes 100 inline images and a cover through the write lifecycle", async () => {
  const t = convexTest(schema, modules);
  register(t);
  const now = Date.now();
  const identity = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Media lifecycle author",
          email: "media-lifecycle@example.com",
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
            token: "media-lifecycle-session",
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  await t.withIdentity(identity).mutation(api.users.syncUser, {});
  const storageIds = await t.run(async (ctx) => {
    const ids = await Promise.all(
      Array.from({ length: 101 }, () =>
        ctx.storage.store(new Blob(["image"], { type: "image/png" })),
      ),
    );
    for (const storageId of ids) {
      await ctx.db.insert("pendingUploads", {
        userId: identity.subject,
        storageId,
        createdAt: now,
        expiresAt: now + 60 * 60 * 1000,
      });
      await ctx.db.insert("sessionMediaClaims", {
        userId: identity.subject,
        sessionId: "editor-1",
        storageId,
        createdAt: now,
        renewedAt: now,
        expiresAt: now + 60 * 60 * 1000,
      });
    }
    return ids;
  });
  const lifecycleProposal = {
    title: "A post with many images",
    body: JSON.stringify({
      format: "blocknote@1",
      blocks: storageIds.slice(0, 100).map((storageId, index) => ({
        type: "image",
        props: {
          storageId,
          altText: "A publication image",
          ...(index === 0
            ? { caption: "This publication has enough readable content." }
            : {}),
        },
      })),
    }),
    tags: ["Technology"],
    imageStorageId: storageIds[100],
  };
  const reservation = await t
    .withIdentity(identity)
    .mutation(api.writeAttempts.reserveAttempt, {
      clientRequestId: "many-media-publication",
      operationKind: "publish",
      proposal: lifecycleProposal,
    });

  const published = assertSucceeded(
    await t.withIdentity(identity).mutation(api.writeAttempts.executeAttempt, {
      attemptId: reservation.attemptId,
      proposal: lifecycleProposal,
    }),
  );
  expect(published.status).toBe("published");
  const consumed = await t.run(async (ctx) => {
    const claims = await ctx.db
      .query("sessionMediaClaims")
      .withIndex("by_userId_and_sessionId", (q) =>
        q.eq("userId", identity.subject).eq("sessionId", "editor-1"),
      )
      .take(102);
    return claims.filter((claim) => claim.consumedAt !== undefined).length;
  });
  expect(consumed).toBe(101);
});
