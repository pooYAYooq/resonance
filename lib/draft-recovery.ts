import {
  canonicalizeProposal,
  type CanonicalProposal,
  type ProposalInput,
} from "./write-contract";

export const DRAFT_RECOVERY_VERSION = 1;
const DRAFT_RECOVERY_PREFIX = "resonance:draft-recovery:";

export type RecoveryResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "write-failed"
        | "remove-failed"
        | "verification-failed";
    };

export type DraftRecoverySnapshot = {
  version: number;
  savedAt: number;
  sessionKey: string;
  proposal: CanonicalProposal;
};

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSnapshot(
  raw: string,
  sessionKey: string,
): DraftRecoverySnapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== DRAFT_RECOVERY_VERSION) return null;
  if (parsed.sessionKey !== sessionKey) return null;
  if (typeof parsed.savedAt !== "number" || !Number.isFinite(parsed.savedAt)) {
    return null;
  }
  const proposal = parsed.proposal;
  if (!isRecord(proposal)) return null;
  if (typeof proposal.title !== "string" || typeof proposal.body !== "string") {
    return null;
  }
  if (
    !Array.isArray(proposal.tags) ||
    !proposal.tags.every((tag) => typeof tag === "string")
  ) {
    return null;
  }
  if (
    proposal.imageStorageId !== undefined &&
    typeof proposal.imageStorageId !== "string"
  ) {
    return null;
  }
  return {
    version: DRAFT_RECOVERY_VERSION,
    savedAt: parsed.savedAt,
    sessionKey,
    proposal: canonicalizeProposal({
      title: proposal.title,
      body: proposal.body,
      tags: proposal.tags as string[],
      ...(proposal.imageStorageId !== undefined && {
        imageStorageId: proposal.imageStorageId,
      }),
    }),
  };
}

export function draftRecoveryStorageKey(sessionKey: string): string {
  return `${DRAFT_RECOVERY_PREFIX}${sessionKey}`;
}

export function saveDraftRecovery(
  sessionKey: string,
  proposal: ProposalInput,
  savedAt = Date.now(),
): RecoveryResult {
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "unavailable" };
  let serialized: string;
  try {
    const snapshot: DraftRecoverySnapshot = {
      version: DRAFT_RECOVERY_VERSION,
      savedAt,
      sessionKey,
      proposal: canonicalizeProposal(proposal),
    };
    serialized = JSON.stringify(snapshot);
    storage.setItem(draftRecoveryStorageKey(sessionKey), serialized);
  } catch {
    return { ok: false, reason: "write-failed" };
  }
  try {
    return storage.getItem(draftRecoveryStorageKey(sessionKey)) === serialized
      ? { ok: true }
      : { ok: false, reason: "verification-failed" };
  } catch {
    return { ok: false, reason: "verification-failed" };
  }
}

export function readDraftRecovery(
  sessionKey: string,
): DraftRecoverySnapshot | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(draftRecoveryStorageKey(sessionKey));
    return raw ? parseSnapshot(raw, sessionKey) : null;
  } catch {
    return null;
  }
}

export function clearDraftRecovery(sessionKey: string): RecoveryResult {
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "unavailable" };
  try {
    storage.removeItem(draftRecoveryStorageKey(sessionKey));
  } catch {
    return { ok: false, reason: "remove-failed" };
  }
  try {
    return storage.getItem(draftRecoveryStorageKey(sessionKey)) === null
      ? { ok: true }
      : { ok: false, reason: "verification-failed" };
  } catch {
    return { ok: false, reason: "verification-failed" };
  }
}
