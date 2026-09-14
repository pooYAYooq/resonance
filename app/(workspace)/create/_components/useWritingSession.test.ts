import { describe, expect, it } from "vitest";
import type { CanonicalProposal } from "@/lib/write-contract";
import {
  createInitialWritingSessionState,
  writingSessionReducer,
} from "./useWritingSession";

const baseline: CanonicalProposal = {
  title: "Saved title",
  body: '{"format":"blocknote@1","blocks":[]}',
  tags: ["Technology"],
};

const changedProposal: CanonicalProposal = {
  ...baseline,
  title: "Local title",
};

function reduce(
  state: ReturnType<typeof createInitialWritingSessionState>,
  action: Parameters<typeof writingSessionReducer>[1],
) {
  return writingSessionReducer(state, action);
}

describe("writingSessionReducer", () => {
  it("establishes a baseline and derives dirty state from canonical equality", () => {
    let state = createInitialWritingSessionState("draft");

    state = reduce(state, {
      type: "establishBaseline",
      proposal: baseline,
      expectedUpdatedAt: 10,
    });
    expect(state.proposal).toEqual(baseline);
    expect(state.baseline).toEqual(baseline);
    expect(state.expectedUpdatedAt).toBe(10);
    expect(state.dirty).toBe(false);

    state = reduce(state, { type: "setProposal", proposal: changedProposal });
    expect(state.dirty).toBe(true);
    state = reduce(state, { type: "setProposal", proposal: baseline });
    expect(state.dirty).toBe(false);
  });

  it("restores the clean baseline after Undo and marks the session dirty again on Redo", () => {
    let state = createInitialWritingSessionState("draft");
    state = reduce(state, {
      type: "establishBaseline",
      proposal: baseline,
    });
    state = reduce(state, { type: "setProposal", proposal: changedProposal });
    expect(state.dirty).toBe(true);

    state = reduce(state, { type: "setProposal", proposal: baseline });
    expect(state.dirty).toBe(false);
    state = reduce(state, { type: "setProposal", proposal: changedProposal });
    expect(state.dirty).toBe(true);
  });

  it("does not let reactive hydration replace a dirty local proposal", () => {
    let state = createInitialWritingSessionState("draft");
    state = reduce(state, {
      type: "establishBaseline",
      proposal: baseline,
      expectedUpdatedAt: 10,
    });
    state = reduce(state, { type: "setProposal", proposal: changedProposal });

    state = reduce(state, {
      type: "hydrate",
      proposal: { ...baseline, title: "New server title" },
      expectedUpdatedAt: 11,
    });

    expect(state.proposal).toEqual(changedProposal);
    expect(state.baseline).toEqual(baseline);
    expect(state.expectedUpdatedAt).toBe(10);
    expect(state.dirty).toBe(true);
  });

  it("keeps the active target while dirty until an explicit target acceptance", () => {
    let state = createInitialWritingSessionState("published-edit", "post-1");
    state = reduce(state, {
      type: "establishBaseline",
      proposal: baseline,
    });
    state = reduce(state, { type: "setProposal", proposal: changedProposal });

    state = reduce(state, {
      type: "requestTarget",
      target: { editorMode: "published-edit", id: "post-2" },
    });
    expect(state.editorMode).toBe("published-edit");
    expect(state.targetId).toBe("post-1");
    expect(state.proposal).toEqual(changedProposal);

    state = reduce(state, {
      type: "acceptTarget",
      target: { editorMode: "published-edit", id: "post-2" },
    });
    expect(state.targetId).toBe("post-2");
    expect(state.proposal).toBeNull();
    expect(state.dirty).toBe(false);
  });

  it("rejects a pending target without changing the active session", () => {
    let state = createInitialWritingSessionState("published-edit", "post-1");
    state = reduce(state, {
      type: "establishBaseline",
      proposal: baseline,
      expectedUpdatedAt: 10,
    });
    state = reduce(state, { type: "setProposal", proposal: changedProposal });
    state = reduce(state, {
      type: "setMedia",
      media: { pending: [], failed: [], coverSelected: true },
    });
    state = reduce(state, {
      type: "confirmTarget",
      target: { editorMode: "published-edit", id: "post-2" },
    });

    const activeSession = {
      baseline: state.baseline,
      dirty: state.dirty,
      editorMode: state.editorMode,
      expectedUpdatedAt: state.expectedUpdatedAt,
      media: state.media,
      proposal: state.proposal,
      targetId: state.targetId,
    };
    state = reduce(state, { type: "rejectTarget" });

    expect(state.pendingTarget).toBeUndefined();
    expect(state).toMatchObject(activeSession);
  });

  it("preserves the proposal and editor history boundary across Review return", () => {
    let state = createInitialWritingSessionState("published-edit");
    state = reduce(state, { type: "setProposal", proposal: changedProposal });
    state = reduce(state, { type: "enterReview" });

    expect(state.presentation).toBe("review");
    expect(state.proposal).toEqual(changedProposal);

    state = reduce(state, { type: "returnToEdit" });
    expect(state.presentation).toBe("edit");
    expect(state.proposal).toEqual(changedProposal);
    expect(state.dirty).toBe(true);
  });

  it("tracks an in-flight operation and adopts a successful save baseline", () => {
    let state = createInitialWritingSessionState("draft");
    state = reduce(state, { type: "setProposal", proposal: changedProposal });
    state = reduce(state, {
      type: "beginOperation",
      operation: "save-draft",
      attemptId: "attempt-1",
    });

    expect(state.operation).toEqual({
      kind: "save-draft",
      attemptId: "attempt-1",
      status: "in-flight",
    });

    state = reduce(state, {
      type: "finishOperation",
      outcome: {
        kind: "succeeded",
        proposal: changedProposal,
        expectedUpdatedAt: 11,
      },
    });
    expect(state.baseline).toEqual(changedProposal);
    expect(state.expectedUpdatedAt).toBe(11);
    expect(state.dirty).toBe(false);
    expect(state.operation).toEqual({ status: "idle" });
  });

  it("ignores a completion from another attempt or session", () => {
    let state = createInitialWritingSessionState("published-edit", "post-1");
    state = reduce(state, { type: "setProposal", proposal: changedProposal });
    state = reduce(state, {
      type: "beginOperation",
      operation: "update-post",
      attemptId: "attempt-1",
      sessionKey: "published-edit:post-1",
    });
    const replacedState = state;

    state = reduce(state, {
      type: "finishOperation",
      attemptId: "attempt-2",
      sessionKey: "published-edit:post-2",
      outcome: {
        kind: "succeeded",
        proposal: changedProposal,
        expectedUpdatedAt: 12,
      },
    });

    expect(state).toEqual(replacedState);
  });

  it("blocks target adoption while persistence is in flight", () => {
    let state = createInitialWritingSessionState("draft");
    state = reduce(state, {
      type: "beginOperation",
      operation: "save-draft",
      attemptId: "attempt-1",
      sessionKey: "draft:new",
    });

    expect(
      reduce(state, {
        type: "requestTarget",
        target: { editorMode: "published-edit", id: "post-2" },
      }),
    ).toEqual(state);
    expect(
      reduce(state, {
        type: "acceptTarget",
        target: { editorMode: "published-edit", id: "post-2" },
      }),
    ).toEqual(state);
  });

  it("does not attach a reservation to a different active session", () => {
    const state = createInitialWritingSessionState("published-edit", "post-2");

    expect(
      reduce(state, {
        type: "beginOperation",
        operation: "update-post",
        attemptId: "attempt-1",
        sessionKey: "published-edit:post-1",
      }),
    ).toEqual(state);
  });

  it("preserves the dirty proposal after failed and uncertain outcomes", () => {
    let state = createInitialWritingSessionState("draft");
    state = reduce(state, {
      type: "establishBaseline",
      proposal: baseline,
    });
    state = reduce(state, { type: "setProposal", proposal: changedProposal });
    state = reduce(state, {
      type: "beginOperation",
      operation: "save-draft",
      attemptId: "attempt-failed",
    });
    state = reduce(state, {
      type: "finishOperation",
      outcome: { kind: "failed", message: "Validation failed" },
    });
    expect(state.proposal).toEqual(changedProposal);
    expect(state.dirty).toBe(true);
    expect(state.operation).toEqual({ status: "idle" });

    state = reduce(state, {
      type: "beginOperation",
      operation: "save-draft",
      attemptId: "attempt-uncertain",
    });
    state = reduce(state, {
      type: "finishOperation",
      outcome: { kind: "indeterminate", message: "Connection lost" },
    });
    expect(state.operation).toMatchObject({
      attemptId: "attempt-uncertain",
      status: "uncertain",
    });
    expect(state.proposal).toEqual(changedProposal);
    expect(reduce(state, { type: "setProposal", proposal: baseline })).toEqual(
      state,
    );
  });

  it("keeps media readiness explicit and independent from proposal equality", () => {
    let state = createInitialWritingSessionState("draft");
    state = reduce(state, {
      type: "setMedia",
      media: { pending: ["upload-1"], failed: [], coverSelected: false },
    });
    expect(state.media).toEqual({
      pending: ["upload-1"],
      failed: [],
      coverSelected: false,
    });
    expect(state.dirty).toBe(true);

    state = reduce(state, {
      type: "setMedia",
      media: { pending: [], failed: [], coverSelected: true },
    });
    expect(state.dirty).toBe(true);
  });

  it("locks without discarding the proposal and deliberately replaces it on Load latest", () => {
    let state = createInitialWritingSessionState("draft");
    state = reduce(state, { type: "setProposal", proposal: changedProposal });
    state = reduce(state, { type: "lockForAuth" });

    expect(state.authLock).toBe("locked");
    expect(state.proposal).toEqual(changedProposal);

    const latest = { ...baseline, title: "Latest title" };
    state = reduce(state, {
      type: "loadLatest",
      proposal: latest,
      expectedUpdatedAt: 12,
    });
    expect(state.authLock).toBe("unlocked");
    expect(state.proposal).toEqual(latest);
    expect(state.baseline).toEqual(latest);
    expect(state.expectedUpdatedAt).toBe(12);
    expect(state.dirty).toBe(false);
  });
});
