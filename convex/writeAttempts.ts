import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { authComponent } from "./auth";
import { fingerprintProposal } from "../lib/write-contract";
import type { MutationCtx } from "./_generated/server";
import {
  executePublish,
  executePublishedUpdate,
  executeSaveDraft,
  type WriteExecutionResult,
} from "./postLifecycle";

const ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

export const writeProposalValidator = v.object({
  title: v.string(),
  body: v.string(),
  tags: v.array(v.string()),
  imageStorageId: v.optional(v.id("_storage")),
});

const operationKindValidator = v.union(
  v.literal("save-draft"),
  v.literal("publish"),
  v.literal("update-post"),
);

const reserveResultValidator = v.object({
  attemptId: v.id("writeAttempts"),
  expiresAt: v.number(),
});

const writeResultValidator = v.object({
  postId: v.id("posts"),
  updatedAt: v.number(),
  status: v.union(v.literal("draft"), v.literal("published")),
});

export type WriteAttempt = Doc<"writeAttempts">;

function sameOptionalValue<T>(left: T | undefined, right: T | undefined) {
  return left === right;
}

function assertSameBinding(
  attempt: WriteAttempt,
  args: {
    operationKind: WriteAttempt["operationKind"];
    postId?: Id<"posts">;
    expectedUpdatedAt?: number;
    fingerprint: string;
  },
) {
  if (
    attempt.operationKind !== args.operationKind ||
    !sameOptionalValue(attempt.postId, args.postId) ||
    !sameOptionalValue(attempt.expectedUpdatedAt, args.expectedUpdatedAt) ||
    attempt.fingerprint !== args.fingerprint
  ) {
    throw new ConvexError("Request binding mismatch");
  }
}

export async function getOwnedAttempt(
  ctx: Pick<MutationCtx, "db">,
  attemptId: Id<"writeAttempts">,
  userId: string,
  now: number,
): Promise<WriteAttempt> {
  const attempt = await ctx.db.get(attemptId);
  if (!attempt || attempt.userId !== userId) {
    throw new ConvexError("Write attempt not found.");
  }
  if (attempt.expiresAt <= now) {
    throw new ConvexError("Write attempt expired.");
  }
  return attempt;
}

export const reserveAttempt = mutation({
  args: {
    clientRequestId: v.string(),
    operationKind: operationKindValidator,
    postId: v.optional(v.id("posts")),
    expectedUpdatedAt: v.optional(v.number()),
    proposal: writeProposalValidator,
  },
  returns: reserveResultValidator,
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");
    if (args.clientRequestId.trim().length === 0) {
      throw new ConvexError("Client request ID is required");
    }

    const fingerprint = await fingerprintProposal(args.proposal);
    const existing = await ctx.db
      .query("writeAttempts")
      .withIndex("by_userId_and_clientRequestId", (q) =>
        q.eq("userId", user._id).eq("clientRequestId", args.clientRequestId),
      )
      .unique();

    if (existing) {
      assertSameBinding(existing, {
        operationKind: args.operationKind,
        postId: args.postId,
        expectedUpdatedAt: args.expectedUpdatedAt,
        fingerprint,
      });
      return { attemptId: existing._id, expiresAt: existing.expiresAt };
    }

    const expiresAt = Date.now() + ATTEMPT_TTL_MS;
    const attemptId = await ctx.db.insert("writeAttempts", {
      userId: user._id,
      clientRequestId: args.clientRequestId,
      operationKind: args.operationKind,
      postId: args.postId,
      expectedUpdatedAt: args.expectedUpdatedAt,
      fingerprint,
      expiresAt,
    });

    return { attemptId, expiresAt };
  },
});

export const executeAttempt = mutation({
  args: {
    attemptId: v.id("writeAttempts"),
    proposal: writeProposalValidator,
  },
  returns: writeResultValidator,
  handler: async (ctx, args): Promise<WriteExecutionResult> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");

    return executeOwnedAttempt(ctx, user._id, args.attemptId, args.proposal);
  },
});

export async function executeOwnedAttempt(
  ctx: MutationCtx,
  userId: string,
  attemptId: Id<"writeAttempts">,
  proposal: {
    title: string;
    body: string;
    tags: string[];
    imageStorageId?: Id<"_storage">;
  },
  expectedOperationKind?: WriteAttempt["operationKind"],
): Promise<WriteExecutionResult> {
  const attempt = await getOwnedAttempt(ctx, attemptId, userId, Date.now());
  if (
    expectedOperationKind !== undefined &&
    attempt.operationKind !== expectedOperationKind
  ) {
    throw new ConvexError("Operation kind mismatch");
  }

  const fingerprint = await fingerprintProposal(proposal);
  if (fingerprint !== attempt.fingerprint) {
    throw new ConvexError("Request binding mismatch");
  }
  if (attempt.outcome?.kind === "succeeded") {
    return {
      postId: attempt.outcome.postId,
      updatedAt: attempt.outcome.updatedAt,
      status: attempt.outcome.status,
    };
  }

  const executionArgs = {
    postId: attempt.postId,
    expectedUpdatedAt: attempt.expectedUpdatedAt,
    proposal,
  };
  const result =
    attempt.operationKind === "save-draft"
      ? await executeSaveDraft(ctx, userId, executionArgs)
      : attempt.operationKind === "publish"
        ? await executePublish(ctx, userId, executionArgs)
        : await executePublishedUpdate(ctx, userId, executionArgs);

  await ctx.db.patch(attempt._id, {
    outcome: {
      kind: "succeeded",
      postId: result.postId,
      updatedAt: result.updatedAt,
      status: result.status,
    },
  });
  return result;
}
