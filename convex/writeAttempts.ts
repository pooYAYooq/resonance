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
  DeterministicWriteError,
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

const writeSuccessValidator = v.object({
  kind: v.literal("succeeded"),
  postId: v.id("posts"),
  updatedAt: v.number(),
  status: v.union(v.literal("draft"), v.literal("published")),
});
const writeFailureValidator = v.object({
  kind: v.literal("failed"),
  category: v.string(),
  message: v.string(),
});
export const writeResultValidator = v.union(
  writeSuccessValidator,
  writeFailureValidator,
);

const reconciliationResultValidator = v.union(
  v.object({
    kind: v.literal("succeeded"),
    postId: v.id("posts"),
    updatedAt: v.number(),
    status: v.union(v.literal("draft"), v.literal("published")),
  }),
  v.object({
    kind: v.literal("failed"),
    category: v.string(),
    message: v.string(),
  }),
  v.object({
    kind: v.literal("indeterminate"),
    message: v.string(),
  }),
);

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

async function getOwnedAttemptRecord(
  ctx: Pick<MutationCtx, "db">,
  attemptId: Id<"writeAttempts">,
  userId: string,
): Promise<WriteAttempt> {
  const attempt = await ctx.db.get(attemptId);
  if (!attempt || attempt.userId !== userId) {
    throw new ConvexError("Write attempt not found.");
  }
  return attempt;
}

function getRecordedOutcome(attempt: WriteAttempt) {
  if (attempt.outcome?.kind === "succeeded") {
    return {
      kind: "succeeded" as const,
      postId: attempt.outcome.postId,
      updatedAt: attempt.outcome.updatedAt,
      status: attempt.outcome.status,
    };
  }
  if (attempt.outcome?.kind === "failed") {
    return {
      kind: "failed" as const,
      category: attempt.outcome.category,
      message: attempt.outcome.message,
    };
  }
  if (attempt.outcome?.kind === "indeterminate") {
    return {
      kind: "indeterminate" as const,
      message: attempt.outcome.message,
    };
  }
  return null;
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
    if (args.postId !== undefined) {
      const target = await ctx.db.get(args.postId);
      if (!target || target.authorId !== user._id) {
        throw new ConvexError("Write target not found.");
      }
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

export const reconcileAttempt = mutation({
  args: {
    attemptId: v.id("writeAttempts"),
    proposal: writeProposalValidator,
  },
  returns: reconciliationResultValidator,
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthorized");

    const attempt = await getOwnedAttemptRecord(ctx, args.attemptId, user._id);
    const fingerprint = await fingerprintProposal(args.proposal);
    if (fingerprint !== attempt.fingerprint) {
      throw new ConvexError("Request binding mismatch");
    }

    const recordedOutcome = getRecordedOutcome(attempt);
    if (recordedOutcome) return recordedOutcome;

    if (attempt.expiresAt > Date.now()) {
      const result = await executeOwnedAttempt(
        ctx,
        user._id,
        args.attemptId,
        args.proposal,
      );
      return result;
    }

    const outcome = {
      kind: "indeterminate" as const,
      message:
        "The write may have succeeded, but no authoritative result remains.",
    };
    await ctx.db.patch(attempt._id, { outcome });
    return outcome;
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
      kind: "succeeded",
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
  let result: WriteExecutionResult;
  try {
    result =
      attempt.operationKind === "save-draft"
        ? await executeSaveDraft(ctx, userId, executionArgs)
        : attempt.operationKind === "publish"
          ? await executePublish(ctx, userId, executionArgs)
          : await executePublishedUpdate(ctx, userId, executionArgs);
  } catch (error) {
    if (!(error instanceof DeterministicWriteError)) throw error;
    const failed = {
      kind: "failed" as const,
      category: error.category,
      message: error.message,
    };
    await ctx.db.patch(attempt._id, { outcome: failed });
    return failed;
  }

  if (result.kind === "failed") {
    await ctx.db.patch(attempt._id, { outcome: result });
    return result;
  }

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
