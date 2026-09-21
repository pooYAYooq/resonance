import {
  canonicalizeProposal,
  getProposalEqualityKey,
  type CanonicalProposal,
  type OperationKind,
} from "@/lib/write-contract";
import { useReducer } from "react";
import type { EditorMode } from "../editorMode";

export type WritingSessionPresentation = "edit" | "review";
export type WritingSessionAuthLock = "unlocked" | "locked";

export type WritingSessionOperation =
  | { status: "idle" }
  | {
      kind: OperationKind;
      attemptId: string;
      sessionKey?: string;
      status: "in-flight" | "uncertain";
      message?: string;
    };

export type WritingSessionMedia = {
  pending: readonly string[];
  failed: readonly string[];
  coverSelected?: boolean;
};

export type WritingSessionTarget = {
  editorMode: Exclude<EditorMode, "invalid">;
  id?: string;
};

export type WritingSessionState = {
  editorMode: Exclude<EditorMode, "invalid">;
  targetId?: string;
  pendingTarget?: WritingSessionTarget;
  proposal: CanonicalProposal | null;
  baseline: CanonicalProposal | null;
  expectedUpdatedAt?: number;
  dirty: boolean;
  presentation: WritingSessionPresentation;
  media: WritingSessionMedia;
  operation: WritingSessionOperation;
  authLock: WritingSessionAuthLock;
  /** True while the active session's stored cover has been explicitly
   * removed. Any target adoption or baseline adoption clears it so a stale
   * intent cannot delete the next target's cover. */
  coverRemoved: boolean;
};

export type WritingSessionAction =
  | {
      type: "setEditorMode";
      editorMode: Exclude<EditorMode, "invalid">;
      targetId?: string;
    }
  | {
      type: "requestTarget";
      target: WritingSessionTarget;
    }
  | {
      type: "confirmTarget";
      target: WritingSessionTarget;
    }
  | {
      type: "acceptTarget";
      target: WritingSessionTarget;
    }
  | { type: "rejectTarget" }
  | {
      type: "establishBaseline";
      proposal: CanonicalProposal;
      expectedUpdatedAt?: number;
    }
  | {
      type: "hydrate";
      proposal: CanonicalProposal;
      expectedUpdatedAt?: number;
    }
  | { type: "setProposal"; proposal: CanonicalProposal }
  | { type: "enterReview" }
  | { type: "returnToEdit" }
  | {
      type: "beginOperation";
      operation: OperationKind;
      attemptId: string;
      sessionKey?: string;
    }
  | {
      type: "finishOperation";
      attemptId?: string;
      sessionKey?: string;
      outcome:
        | {
            kind: "succeeded";
            proposal: CanonicalProposal;
            expectedUpdatedAt?: number;
          }
        | { kind: "failed"; message: string }
        | { kind: "indeterminate"; message: string };
    }
  | { type: "lockForAuth" }
  | {
      type: "setMedia";
      media: WritingSessionMedia;
    }
  | {
      type: "appendFailedMedia";
      storageId: string;
    }
  | {
      type: "clearFailedMedia";
      storageId: string;
    }
  | {
      type: "loadLatest";
      proposal: CanonicalProposal;
      expectedUpdatedAt?: number;
    }
  | {
      type: "setCoverRemoved";
      removed: boolean;
    };

export function createInitialWritingSessionState(
  editorMode: Exclude<EditorMode, "invalid">,
  targetId?: string,
): WritingSessionState {
  return {
    editorMode,
    targetId,
    pendingTarget: undefined,
    proposal: null,
    baseline: null,
    dirty: false,
    presentation: "edit",
    media: { pending: [], failed: [], coverSelected: false },
    operation: { status: "idle" },
    authLock: "unlocked",
    coverRemoved: false,
  };
}

export function useWritingSession(
  editorMode: Exclude<EditorMode, "invalid">,
  targetId?: string,
) {
  return useReducer(
    writingSessionReducer,
    createInitialWritingSessionState(editorMode, targetId),
  );
}

function adoptTarget(target: WritingSessionTarget): WritingSessionState {
  return createInitialWritingSessionState(target.editorMode, target.id);
}

function isDirty(
  proposal: CanonicalProposal | null,
  baseline: CanonicalProposal | null,
  media: WritingSessionMedia,
) {
  if (
    media.coverSelected ||
    media.pending.length > 0 ||
    media.failed.length > 0
  ) {
    return true;
  }
  if (proposal === null || baseline === null) return proposal !== baseline;
  return getProposalEqualityKey(proposal) !== getProposalEqualityKey(baseline);
}

function adoptBaseline(
  state: WritingSessionState,
  proposal: CanonicalProposal,
  expectedUpdatedAt?: number,
): WritingSessionState {
  return {
    ...state,
    proposal,
    baseline: proposal,
    pendingTarget: undefined,
    expectedUpdatedAt,
    dirty: false,
    media: { pending: [], failed: [], coverSelected: false },
    presentation: "edit",
    operation: { status: "idle" },
    authLock: "unlocked",
    coverRemoved: false,
  };
}

export function writingSessionReducer(
  state: WritingSessionState,
  action: WritingSessionAction,
): WritingSessionState {
  switch (action.type) {
    case "setEditorMode":
      return state.dirty || state.operation.status === "in-flight"
        ? state
        : createInitialWritingSessionState(action.editorMode, action.targetId);

    case "requestTarget":
      return state.dirty || state.operation.status === "in-flight"
        ? state
        : adoptTarget(action.target);

    case "confirmTarget":
      return state.operation.status === "in-flight"
        ? state
        : state.dirty
          ? { ...state, pendingTarget: action.target }
          : adoptTarget(action.target);

    case "acceptTarget":
      return state.operation.status === "in-flight"
        ? state
        : adoptTarget(action.target);

    case "rejectTarget":
      return { ...state, pendingTarget: undefined };

    case "establishBaseline":
      return adoptBaseline(
        state,
        canonicalizeProposal(action.proposal),
        action.expectedUpdatedAt,
      );

    case "hydrate":
      return state.dirty
        ? state
        : adoptBaseline(
            state,
            canonicalizeProposal(action.proposal),
            action.expectedUpdatedAt,
          );

    case "setProposal": {
      if (
        state.authLock === "locked" ||
        state.operation.status === "uncertain"
      ) {
        return state;
      }
      const proposal = canonicalizeProposal(action.proposal);
      return {
        ...state,
        proposal,
        dirty: isDirty(proposal, state.baseline, state.media),
      };
    }

    case "enterReview":
      return { ...state, presentation: "review" };

    case "returnToEdit":
      return { ...state, presentation: "edit" };

    case "beginOperation":
      if (
        action.sessionKey &&
        action.sessionKey !== `${state.editorMode}:${state.targetId ?? "new"}`
      ) {
        return state;
      }
      return {
        ...state,
        operation: {
          kind: action.operation,
          attemptId: action.attemptId,
          status: "in-flight",
          ...(action.sessionKey && { sessionKey: action.sessionKey }),
        },
      };

    case "finishOperation":
      if (
        action.attemptId &&
        (state.operation.status !== "in-flight" ||
          state.operation.attemptId !== action.attemptId ||
          (action.sessionKey &&
            state.operation.sessionKey !== action.sessionKey))
      ) {
        return state;
      }
      if (action.outcome.kind === "succeeded") {
        return adoptBaseline(
          state,
          canonicalizeProposal(action.outcome.proposal),
          action.outcome.expectedUpdatedAt,
        );
      }
      if (action.outcome.kind === "indeterminate") {
        if (state.operation.status !== "in-flight") return state;
        return {
          ...state,
          operation: {
            ...state.operation,
            status: "uncertain",
            message: action.outcome.message,
          },
        };
      }
      return { ...state, operation: { status: "idle" } };

    case "lockForAuth":
      return { ...state, authLock: "locked" };

    case "setMedia":
      return {
        ...state,
        media: action.media,
        dirty: isDirty(state.proposal, state.baseline, action.media),
      };

    case "appendFailedMedia": {
      if (state.media.failed.includes(action.storageId)) return state;
      const media = {
        ...state.media,
        failed: [...state.media.failed, action.storageId],
      };
      return {
        ...state,
        media,
        dirty: isDirty(state.proposal, state.baseline, media),
      };
    }

    case "clearFailedMedia": {
      if (!state.media.failed.includes(action.storageId)) return state;
      const media = {
        ...state.media,
        failed: state.media.failed.filter((id) => id !== action.storageId),
      };
      return {
        ...state,
        media,
        dirty: isDirty(state.proposal, state.baseline, media),
      };
    }

    case "loadLatest":
      return adoptBaseline(
        state,
        canonicalizeProposal(action.proposal),
        action.expectedUpdatedAt,
      );

    case "setCoverRemoved":
      return { ...state, coverRemoved: action.removed };
  }
}
