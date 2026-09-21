"use client";

import { useEffect, useRef } from "react";
import { clearDraftRecovery, saveDraftRecovery } from "@/lib/draft-recovery";
import type { CanonicalProposal } from "@/lib/write-contract";

export const DRAFT_RECOVERY_DEBOUNCE_MS = 1000;

type UseDraftRecoveryOptions = {
  sessionKey: string;
  ready: boolean;
  dirty: boolean;
  proposal: CanonicalProposal;
};

/**
 * Persists unsaved new-post/draft work; published edits remain page-local.
 *
 * Keeps a local snapshot while the session is dirty (debounced, flushed on
 * `pagehide`) and clears the snapshot after a successful save or publish. There
 * is deliberately no `beforeunload` prompt. Detection and the restore prompt
 * are owned by the page, which knows the server baseline.
 */
export function useDraftRecovery({
  sessionKey,
  ready,
  dirty,
  proposal,
}: UseDraftRecoveryOptions): void {
  // Published edits are deliberately page-local until Update Post succeeds.
  const recoverable = !sessionKey.startsWith("published-edit:");
  useEffect(() => {
    if (!recoverable) clearDraftRecovery(sessionKey);
  }, [recoverable, sessionKey]);
  // Latest values for the unload listener, synced in an effect (not during
  // render) so the listener can register with a stable dependency.
  const latestRef = useRef({ sessionKey, ready, dirty, proposal });
  useEffect(() => {
    latestRef.current = { sessionKey, ready, dirty, proposal };
  }, [sessionKey, ready, dirty, proposal]);

  // Persist dirty proposals, debounced to one write per pause in editing.
  useEffect(() => {
    if (!recoverable || !ready || !dirty) return;
    const timer = window.setTimeout(() => {
      saveDraftRecovery(sessionKey, proposal);
    }, DRAFT_RECOVERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, proposal, ready, sessionKey, recoverable]);

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
    const flush = () => {
      const latest = latestRef.current;
      if (
        latest.ready &&
        latest.dirty &&
        !latest.sessionKey.startsWith("published-edit:")
      ) {
        saveDraftRecovery(latest.sessionKey, latest.proposal);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);
}
