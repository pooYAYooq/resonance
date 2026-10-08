"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  clearDraftRecovery,
  saveDraftRecovery,
  type RecoveryResult,
} from "@/lib/draft-recovery";
import type { CanonicalProposal } from "@/lib/write-contract";

export const DRAFT_RECOVERY_DEBOUNCE_MS = 1000;

type UseDraftRecoveryOptions = {
  sessionKey: string;
  ready: boolean;
  dirty: boolean;
  proposal: CanonicalProposal;
};

type DraftRecoveryControl = {
  flush: () => RecoveryResult;
  abandon: () => RecoveryResult;
  resume: () => void;
};

/**
 * Persists unsaved new-post/draft work; published edits remain page-local.
 *
 * Keeps a local snapshot while the session is dirty (debounced, flushed on
 * `pagehide`) and clears the snapshot after a successful save or publish. It
 * has no `beforeunload` prompt. The page owns detection and silent restoration.
 * Explicit abandonment suspends old-session writes before removing recovery.
 */
export function useDraftRecovery({
  sessionKey,
  ready,
  dirty,
  proposal,
}: UseDraftRecoveryOptions): DraftRecoveryControl {
  // Published edits are deliberately page-local until Update Post succeeds.
  const recoverable = !sessionKey.startsWith("published-edit:");
  useEffect(() => {
    if (!recoverable) clearDraftRecovery(sessionKey);
  }, [recoverable, sessionKey]);
  // Latest values for the unload listener, synced in an effect (not during
  // render) so the listener can register with a stable dependency.
  const latestRef = useRef({ sessionKey, ready, dirty, proposal });
  const abandonedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    latestRef.current = { sessionKey, ready, dirty, proposal };
  }, [sessionKey, ready, dirty, proposal]);

  const flush = useCallback((): RecoveryResult => {
    const latest = latestRef.current;
    if (
      abandonedKeyRef.current === latest.sessionKey ||
      !latest.ready ||
      latest.sessionKey.startsWith("published-edit:")
    ) {
      return { ok: false, reason: "unavailable" };
    }
    return latest.dirty
      ? saveDraftRecovery(latest.sessionKey, latest.proposal)
      : { ok: true };
  }, []);

  const abandon = useCallback((): RecoveryResult => {
    const key = latestRef.current.sessionKey;
    abandonedKeyRef.current = key;
    if (key.startsWith("published-edit:")) {
      // Published edits never persist a recovery copy, so abandonment has
      // nothing to verify. Remove any stale snapshot best-effort.
      clearDraftRecovery(key);
      return { ok: true };
    }
    return clearDraftRecovery(key);
  }, []);

  const resume = useCallback(() => {
    abandonedKeyRef.current = null;
    flush();
  }, [flush]);

  // Persist dirty proposals, debounced to one write per pause in editing.
  useEffect(() => {
    if (!recoverable || !ready || !dirty) return;
    const timer = window.setTimeout(() => {
      flush();
    }, DRAFT_RECOVERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, proposal, ready, sessionKey, recoverable, flush]);

  // A dirty session that turns clean means the work was saved, or the author
  // reverted it, or it was emptied. Either way the local snapshot is stale and
  // must be cleared, otherwise it would silently resurrect removed content.
  const sessionDirtyRef = useRef({ key: sessionKey, dirty: false });
  useEffect(() => {
    const previous = sessionDirtyRef.current;
    if (previous.key !== sessionKey) {
      // A key change only happens when the reducer adopts a target, either
      // because the session was clean or because the author confirmed a
      // discard. Clear the abandoned key's snapshot so a confirmed discard is
      // not silently restored later.
      clearDraftRecovery(previous.key);
      // Arriving at a session makes it active again: an abandonment latch
      // from an earlier switch must never silence writes for the session the
      // author is editing now.
      abandonedKeyRef.current = null;
      sessionDirtyRef.current = { key: sessionKey, dirty };
      return;
    }
    if (dirty && !previous.dirty) {
      previous.dirty = true;
      return;
    }
    if (!dirty && previous.dirty) {
      previous.dirty = false;
      clearDraftRecovery(sessionKey);
    }
  }, [dirty, sessionKey]);

  // Flush the latest proposal synchronously when the page is being discarded.
  useEffect(() => {
    const onPageHide = () => {
      flush();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flush]);

  return useMemo(() => ({ flush, abandon, resume }), [flush, abandon, resume]);
}
