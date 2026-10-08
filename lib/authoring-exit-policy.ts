import type { WritingSessionTarget } from "@/app/(workspace)/create/_components/useWritingSession";
import { hasUnsavedAuthoringWork } from "./authoring-unsaved-work";
import {
  getProposalEqualityKey,
  type CanonicalProposal,
} from "./write-contract";

/**
 * Pure exit policy for authoring sessions. It answers three questions with no
 * browser, router, or storage knowledge: does the session carry unsaved work,
 * does a browser unload need a native warning, and what should happen when the
 * author attempts to leave.
 */

export type ExitIntent =
  | { kind: "navigate"; href: string }
  | { kind: "history"; key: string; href: string }
  | { kind: "start-fresh" }
  | { kind: "cancel-update" }
  | { kind: "target"; href: string; target: WritingSessionTarget }
  | { kind: "sign-out" };

export type ExitSession = {
  sessionKey: string;
  mode: "new" | "draft" | "published-edit";
  proposal: CanonicalProposal;
  baseline: CanonicalProposal | null;
  selectedCover: boolean;
  pendingUploads: number;
  failedMedia: boolean;
  saving: boolean;
  uncertain: boolean;
  coverRemoved: boolean;
};

export type ExitDecision =
  | { kind: "allow" }
  | { kind: "recover" }
  | {
      kind: "confirm";
      level: "light" | "strong" | "switch";
      risk:
        | "unsaved"
        | "published-edit"
        | "cover"
        | "storage"
        | "abandon"
        | "sign-out";
      canSaveDraft: boolean;
    }
  | { kind: "block"; reason: "operation" | "uncertain" | "loading" };

export type ExitSaveResult =
  | { kind: "saved" }
  | { kind: "failed"; message: string }
  | { kind: "uncertain"; message: string };

export type TargetCheck = { ok: true } | { ok: false; message: string };

/**
 * True when the session holds work a departure could lose: meaningful
 * proposal differences, a selected or removed cover, failed media, or
 * unresolved uploads. A loading baseline is not yet comparable.
 */
export function hasUnsavedWork(session: ExitSession): boolean {
  if (session.baseline === null) return false;
  if (
    session.selectedCover ||
    session.failedMedia ||
    session.coverRemoved ||
    session.pendingUploads > 0
  ) {
    return true;
  }
  return hasUnsavedAuthoringWork(session.proposal, session.baseline);
}

/**
 * True while the native beforeunload warning should protect the tab. Covers
 * unsaved work plus in-flight or uncertain operations, which cannot be
 * prevented from leaving but should still warn.
 */
export function hasNativeExitRisk(session: ExitSession): boolean {
  return (
    session.uncertain ||
    session.saving ||
    session.pendingUploads > 0 ||
    hasUnsavedWork(session)
  );
}

/**
 * Stable identity of the proposal handed to a save. Continuations compare the
 * captured persisted key with live state instead of re-reading the form.
 */
export function getExitProposalKey(proposal: CanonicalProposal): string {
  return getProposalEqualityKey(proposal);
}

/**
 * Decides what an exit attempt should do. In-flight and uncertain operations
 * override every in-app exit; a loading baseline blocks unsafe decisions.
 * New/draft app navigation may recover silently, browser history always
 * confirms, and published edits never rely on page-local recovery.
 */
export function decideAuthoringExit(
  intent: ExitIntent,
  session: ExitSession,
): ExitDecision {
  if (session.uncertain) return { kind: "block", reason: "uncertain" };
  if (session.saving || session.pendingUploads > 0) {
    return { kind: "block", reason: "operation" };
  }
  if (session.baseline === null) {
    return { kind: "block", reason: "loading" };
  }

  const unsaved = hasUnsavedWork(session);
  const coverRisk =
    session.selectedCover || session.failedMedia || session.coverRemoved;

  switch (intent.kind) {
    case "navigate":
      if (!unsaved) return { kind: "allow" };
      if (coverRisk) {
        return {
          kind: "confirm",
          level: "light",
          risk: "cover",
          canSaveDraft: true,
        };
      }
      if (session.mode === "published-edit") {
        return {
          kind: "confirm",
          level: "light",
          risk: "published-edit",
          canSaveDraft: true,
        };
      }
      return { kind: "recover" };

    case "history":
      if (!unsaved) return { kind: "allow" };
      if (coverRisk) {
        return {
          kind: "confirm",
          level: "light",
          risk: "cover",
          canSaveDraft: true,
        };
      }
      return {
        kind: "confirm",
        level: "light",
        risk: session.mode === "published-edit" ? "published-edit" : "unsaved",
        canSaveDraft: true,
      };

    case "target":
      if (!unsaved) return { kind: "allow" };
      return {
        kind: "confirm",
        level: "switch",
        risk: "abandon",
        canSaveDraft: true,
      };

    case "start-fresh":
    case "cancel-update":
      if (!unsaved) return { kind: "allow" };
      return {
        kind: "confirm",
        level: "switch",
        risk: "abandon",
        canSaveDraft: false,
      };

    case "sign-out":
      if (!unsaved) return { kind: "allow" };
      return {
        kind: "confirm",
        level: "strong",
        risk: "sign-out",
        canSaveDraft: true,
      };
  }
}
