"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createHistoryTraversalGuard,
  getNavigationApi,
  type HistoryTraversalGuard,
} from "@/lib/authoring-history";
import {
  decideAuthoringExit,
  hasNativeExitRisk,
  hasUnsavedWork,
  type ExitDecision,
  type ExitIntent,
  type ExitSaveResult,
  type ExitSession,
  type TargetCheck,
} from "@/lib/authoring-exit-policy";
import type { RecoveryResult } from "@/lib/draft-recovery";
import type { WritingSessionTarget } from "@/app/(workspace)/create/_components/useWritingSession";
import { AuthoringExitDialog } from "./AuthoringExitDialog";
import { resolveEditorMode } from "@/app/(workspace)/create/editorMode";

/**
 * The editor-facing contract. The page produces one registration while it
 * owns a live document; the provider consumes it for every exit decision.
 */
export type ExitRegistration = {
  getSession: () => ExitSession;
  /** Optional change notifications so native warning state stays fresh. */
  subscribe?: (listener: () => void) => () => void;
  flushRecovery: () => RecoveryResult;
  clearRecovery: () => RecoveryResult;
  saveDraft: () => Promise<ExitSaveResult>;
  validateTarget: (target: WritingSessionTarget) => Promise<TargetCheck>;
  adoptTarget: (target: WritingSessionTarget) => void;
  startFresh: () => void;
  cancelUpdate: () => void;
  reconcile: () => Promise<void>;
  resumeRecovery: () => void;
};

type SignOutAction = () => Promise<{ ok: boolean; message?: string }>;

type AuthoringExitContextValue = {
  isSigningOut: boolean;
  register: (registration: ExitRegistration) => () => void;
  request: (intent: ExitIntent) => void;
  requestSignOut: (
    action: SignOutAction,
    returnFocus?: HTMLElement | null,
  ) => void;
};

const AuthoringExitContext = createContext<AuthoringExitContextValue | null>(
  null,
);

export function useAuthoringExit(): AuthoringExitContextValue {
  const value = useContext(AuthoringExitContext);
  if (!value) {
    throw new Error(
      "useAuthoringExit must be used within AuthoringExitProvider",
    );
  }
  return value;
}

/** Shared navigation can also render outside the root provider in isolation. */
export function useOptionalAuthoringExit() {
  return useContext(AuthoringExitContext);
}

type PendingDecision = Extract<ExitDecision, { kind: "confirm" | "block" }>;

type PendingSurface = {
  intent: ExitIntent;
  decision: PendingDecision;
  error: string | null;
  busy: boolean;
};

/**
 * Navigation coordinator mounted above every route group. Editors register
 * their save/exit contract; ordinary app-link clicks, browser history
 * traversals, and explicit sign outs are decided by the pure policy and
 * surfaced through one accessible dialog at a time. With no registration it
 * stays completely transparent.
 */
export function AuthoringExitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [signOutPath, setSignOutPath] = useState<string | null>(null);
  const isSigningOut = signOutPath !== null && signOutPath === pathname;
  // Keep the workspace hidden until the successful redirect commits, not just
  // until the auth request resolves. A failed request restores the same editor.
  if (signOutPath !== null && signOutPath !== pathname) setSignOutPath(null);
  const runSignOut = useCallback(
    async (action: SignOutAction) => {
      setSignOutPath(pathname);
      try {
        const result = await action();
        if (!result.ok) setSignOutPath(null);
        return result;
      } catch (error) {
        setSignOutPath(null);
        throw error;
      }
    },
    [pathname],
  );
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const registrationRef = useRef<ExitRegistration | null>(null);
  const historyGuardRef = useRef<HistoryTraversalGuard | null>(null);
  const signOutActionRef = useRef<SignOutAction | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const surfaceRef = useRef<PendingSurface | null>(null);
  const beforeUnloadRef = useRef<((event: BeforeUnloadEvent) => void) | null>(
    null,
  );
  const nativeAttachedRef = useRef(false);
  const [surface, setSurfaceState] = useState<PendingSurface | null>(null);

  const updateSurface = useCallback((next: PendingSurface | null) => {
    surfaceRef.current = next;
    setSurfaceState(next);
  }, []);

  const syncNativeRisk = useCallback(() => {
    const handler = beforeUnloadRef.current;
    if (!handler) return;
    const registration = registrationRef.current;
    const risky = registration
      ? hasNativeExitRisk(registration.getSession())
      : false;
    if (risky && !nativeAttachedRef.current) {
      window.addEventListener("beforeunload", handler);
      nativeAttachedRef.current = true;
    } else if (!risky && nativeAttachedRef.current) {
      window.removeEventListener("beforeunload", handler);
      nativeAttachedRef.current = false;
    }
  }, []);

  const continueIntent = useCallback(
    (intent: ExitIntent) => {
      switch (intent.kind) {
        case "navigate":
          routerRef.current.push(intent.href);
          return;
        case "history": {
          const replayed = historyGuardRef.current?.replay(intent.key) ?? false;
          if (!replayed) routerRef.current.push(intent.href);
          return;
        }
        case "target":
          void (async () => {
            const registration = registrationRef.current;
            if (!registration) return;
            const sessionKey = registration.getSession().sessionKey;
            const decision: PendingDecision = {
              kind: "confirm",
              level: "switch",
              risk: "abandon",
              canSaveDraft: true,
            };
            updateSurface({ intent, decision, busy: true, error: null });
            try {
              const checked = await registration.validateTarget(intent.target);
              if (
                registrationRef.current !== registration ||
                registration.getSession().sessionKey !== sessionKey
              )
                return;
              if (!checked.ok) {
                updateSurface({
                  intent,
                  decision,
                  busy: false,
                  error: checked.message,
                });
                return;
              }
              // Published edits never persist a recovery copy, and clean
              // sessions have nothing to protect: only a dirty recoverable
              // session requires verified deletion before switching.
              const session = registration.getSession();
              const cleanupRequired =
                session.mode !== "published-edit" && hasUnsavedWork(session);
              const cleared = registration.clearRecovery();
              if (!cleared.ok && cleanupRequired) {
                registration.resumeRecovery();
                updateSurface({
                  intent,
                  decision,
                  busy: false,
                  error:
                    "The recovery copy could not be cleared. Keep editing and try again.",
                });
                return;
              }
              registration.adoptTarget(intent.target);
              updateSurface(null);
              routerRef.current.push(intent.href);
            } catch (error) {
              if (registrationRef.current === registration)
                updateSurface({
                  intent,
                  decision,
                  busy: false,
                  error: error instanceof Error ? error.message : String(error),
                });
            }
          })();
          return;
        case "sign-out":
          void (async () => {
            const action = signOutActionRef.current;
            const registration = registrationRef.current;
            if (!action) return;
            if (!registration) {
              await runSignOut(action);
              return;
            }
            const session = registration.getSession();
            // Only a session with unsaved work keeps a progress surface: a
            // clean sign out must stay silent while authentication resolves.
            const needsSurface = hasUnsavedWork(session);
            const decision: PendingDecision = {
              kind: "confirm",
              level: "strong",
              risk: "sign-out",
              canSaveDraft: true,
            };
            if (needsSurface) {
              updateSurface({ intent, decision, busy: true, error: null });
            }
            // Published edits never persist a recovery copy, and clean
            // sessions have nothing to protect: only a dirty recoverable
            // session requires verified deletion before signing out.
            const cleanupRequired =
              session.mode !== "published-edit" && needsSurface;
            const cleared = registration.clearRecovery();
            if (!cleared.ok && cleanupRequired) {
              registration.resumeRecovery();
              updateSurface({
                intent,
                decision,
                busy: false,
                error:
                  "The recovery copy could not be cleared. Keep editing and try again.",
              });
              return;
            }
            try {
              const result = await runSignOut(action);
              if (registrationRef.current !== registration) return;
              if (!result.ok) {
                registration.resumeRecovery();
                if (needsSurface) {
                  updateSurface({
                    intent,
                    decision,
                    busy: false,
                    error:
                      result.message ??
                      "Sign out failed. Your writing is still here.",
                  });
                }
                return;
              }
              updateSurface(null);
            } catch (error) {
              if (registrationRef.current !== registration) return;
              registration.resumeRecovery();
              if (needsSurface) {
                updateSurface({
                  intent,
                  decision,
                  busy: false,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          })();
          return;
        case "start-fresh":
          registrationRef.current?.startFresh();
          return;
        case "cancel-update":
          registrationRef.current?.cancelUpdate();
          return;
      }
    },
    [updateSurface, runSignOut],
  );
  const continueIntentRef = useRef(continueIntent);
  useEffect(() => {
    continueIntentRef.current = continueIntent;
  }, [continueIntent]);

  const openSurface = useCallback(
    (intent: ExitIntent, decision: PendingDecision) => {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      updateSurface({ intent, decision, error: null, busy: false });
    },
    [updateSurface],
  );
  const openSurfaceRef = useRef(openSurface);
  useEffect(() => {
    openSurfaceRef.current = openSurface;
  }, [openSurface]);

  const proceed = useCallback((intent: ExitIntent, decision: ExitDecision) => {
    if (decision.kind === "allow") {
      continueIntentRef.current(intent);
      return;
    }
    if (decision.kind === "recover") {
      const result = registrationRef.current?.flushRecovery();
      if (result?.ok) {
        continueIntentRef.current(intent);
        return;
      }
      // A recovery write that cannot be verified is never silent.
      openSurfaceRef.current(intent, {
        kind: "confirm",
        level: "light",
        risk: "storage",
        canSaveDraft: true,
      });
      return;
    }
    openSurfaceRef.current(intent, decision);
  }, []);

  const request = useCallback(
    (intent: ExitIntent) => {
      // One destination at a time: repeated requests never stack.
      if (surfaceRef.current) return;
      const registration = registrationRef.current;
      if (!registration) {
        if (intent.kind === "navigate") routerRef.current.push(intent.href);
        else if (intent.kind === "sign-out") continueIntentRef.current(intent);
        return;
      }
      if (intent.kind === "navigate") {
        const destination = new URL(intent.href, window.location.href);
        if (destination.pathname === "/create") {
          const requested = resolveEditorMode({
            draftId: destination.searchParams.get("draftId") ?? undefined,
            editPostId: destination.searchParams.get("editPostId") ?? undefined,
          });
          if (requested.mode !== "invalid") {
            if (
              `${requested.mode}:${requested.id ?? "new"}` ===
              registration.getSession().sessionKey
            ) {
              // The click asked for the document already open; honor it
              // without treating it as a departure.
              routerRef.current.push(intent.href);
              return;
            }
            intent = {
              kind: "target",
              href: intent.href,
              target: { editorMode: requested.mode, id: requested.id },
            };
          }
        }
      }
      proceed(intent, decideAuthoringExit(intent, registration.getSession()));
    },
    [proceed],
  );
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  const requestSignOut = useCallback(
    (action: SignOutAction, returnFocus?: HTMLElement | null) => {
      signOutActionRef.current = action;
      requestRef.current({ kind: "sign-out" });
      if (returnFocus) restoreFocusRef.current = returnFocus;
    },
    [],
  );

  const register = useCallback(
    (registration: ExitRegistration) => {
      registrationRef.current = registration;
      const unsubscribe = registration.subscribe?.(() => syncNativeRisk());
      syncNativeRisk();
      return () => {
        unsubscribe?.();
        if (registrationRef.current === registration) {
          registrationRef.current = null;
          syncNativeRisk();
        }
      };
    },
    [syncNativeRisk],
  );

  const handleStay = useCallback(() => {
    const entry = surfaceRef.current;
    if (!entry || entry.busy) return;
    updateSurface(null);
  }, [updateSurface]);

  const handleLeave = useCallback(() => {
    const entry = surfaceRef.current;
    if (!entry || entry.busy) return;
    updateSurface(null);
    continueIntentRef.current(entry.intent);
  }, [updateSurface]);

  const handleRestoreFocus = useCallback(() => {
    const element = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (element && element.isConnected) element.focus();
  }, []);

  const handleSave = useCallback(async () => {
    const entry = surfaceRef.current;
    if (!entry || entry.busy) return;
    const registration = registrationRef.current;
    if (!registration) {
      updateSurface(null);
      return;
    }
    const token = registration;
    updateSurface({ ...entry, busy: true, error: null });

    let result: ExitSaveResult;
    try {
      if (entry.intent.kind === "target") {
        const checked = await registration.validateTarget(entry.intent.target);
        if (!checked.ok) {
          if (registrationRef.current === token)
            updateSurface({ ...entry, busy: false, error: checked.message });
          return;
        }
      }
      if (
        registrationRef.current !== token ||
        surfaceRef.current?.intent !== entry.intent
      )
        return;
      result = await registration.saveDraft();
    } catch (error) {
      result = {
        kind: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    // A save that resolves after its editor unmounted or changed never
    // navigates on stale state.
    if (registrationRef.current !== token) return;
    const current = surfaceRef.current;
    if (!current || current.intent !== entry.intent) return;

    if (result.kind === "saved") {
      const decision = decideAuthoringExit(
        entry.intent,
        registration.getSession(),
      );
      if (decision.kind === "allow") {
        updateSurface(null);
        continueIntentRef.current(entry.intent);
        return;
      }
      if (decision.kind === "recover") {
        // Saving an older proposal is not permission to abandon newer work.
        // Preserve the original destination and ask again, even when ordinary
        // draft navigation could otherwise rely on silent recovery.
        updateSurface({
          ...entry,
          decision: {
            kind: "confirm",
            level: "light",
            risk: "unsaved",
            canSaveDraft: true,
          },
          busy: false,
          error: null,
        });
        return;
      }
      // Newer work appeared during the save: ask again with fresh risk.
      updateSurface({ ...entry, decision, busy: false, error: null });
      return;
    }

    if (result.kind === "uncertain") {
      updateSurface({
        ...entry,
        decision: { kind: "block", reason: "uncertain" },
        busy: false,
        error: result.message,
      });
      return;
    }

    updateSurface({ ...entry, busy: false, error: result.message });
  }, [updateSurface]);

  const handleReconcile = useCallback(async () => {
    const entry = surfaceRef.current;
    if (!entry || entry.busy) return;
    const registration = registrationRef.current;
    if (!registration) return;
    const token = registration;
    updateSurface({ ...entry, busy: true, error: null });

    try {
      await registration.reconcile();
    } catch (error) {
      if (registrationRef.current !== token) return;
      const current = surfaceRef.current;
      if (current && current.intent === entry.intent) {
        updateSurface({
          ...current,
          busy: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (registrationRef.current !== token) return;
    const current = surfaceRef.current;
    if (!current || current.intent !== entry.intent) return;
    const decision = decideAuthoringExit(
      entry.intent,
      registration.getSession(),
    );
    if (decision.kind === "allow") {
      // A reconciliation never navigates on its own; the risk simply cleared.
      updateSurface(null);
      return;
    }
    const pendingDecision: PendingDecision =
      decision.kind === "recover"
        ? {
            kind: "confirm",
            level: "light",
            risk: "unsaved",
            canSaveDraft: true,
          }
        : decision;
    updateSurface({
      ...current,
      decision: pendingDecision,
      busy: false,
      error: null,
    });
  }, [updateSurface]);

  // Capture plain same-origin app-link clicks before Next's Link handling.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target.toLowerCase() !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const rawHref = anchor.getAttribute("href");
      if (rawHref === null || rawHref === "") return;
      if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (destination.origin !== window.location.origin) return;
      if (
        destination.protocol !== "http:" &&
        destination.protocol !== "https:"
      ) {
        return;
      }
      const current = window.location;
      // Identical destinations and hash-only changes are not departures.
      if (
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        return;
      }
      if (!registrationRef.current) return;

      event.preventDefault();
      requestRef.current({
        kind: "navigate",
        href: destination.pathname + destination.search + destination.hash,
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Browser Back/Forward cancellation through the Navigation API. Without
  // that API a same-document traversal cannot be cancelled, so persist
  // recoverable work synchronously before the editor unmounts (best effort;
  // no dialog is possible). Published edits stay page-local by design.
  useEffect(() => {
    const navigation = getNavigationApi();
    if (!navigation) {
      const onPopState = () => {
        registrationRef.current?.flushRecovery();
      };
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    }
    const guard = createHistoryTraversalGuard({
      navigation,
      onTraverse: (destination) => {
        const registration = registrationRef.current;
        if (!registration) return false;
        if (surfaceRef.current) return true;
        const intent: ExitIntent = {
          kind: "history",
          key: destination.key,
          href: destination.href,
        };
        const decision = decideAuthoringExit(intent, registration.getSession());
        if (decision.kind === "allow") return false;
        if (decision.kind !== "confirm" && decision.kind !== "block")
          return false;
        openSurfaceRef.current(intent, decision);
        return true;
      },
    });
    historyGuardRef.current = guard;
    return () => {
      guard.dispose();
      if (historyGuardRef.current === guard) historyGuardRef.current = null;
    };
  }, []);

  // Native unload warnings while unsaved or unresolved, best effort only.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    beforeUnloadRef.current = handler;
    syncNativeRisk();
    return () => {
      beforeUnloadRef.current = null;
      if (nativeAttachedRef.current) {
        window.removeEventListener("beforeunload", handler);
        nativeAttachedRef.current = false;
      }
    };
  }, [syncNativeRisk]);

  const contextValue = useMemo(
    () => ({ register, request, requestSignOut, isSigningOut }),
    [register, request, requestSignOut, isSigningOut],
  );

  return (
    <AuthoringExitContext.Provider value={contextValue}>
      {children}
      <AuthoringExitDialog
        open={surface !== null}
        decision={surface?.decision ?? { kind: "block", reason: "loading" }}
        pending={surface?.busy ?? false}
        error={surface?.error ?? null}
        onStay={handleStay}
        onLeave={handleLeave}
        onSave={() => {
          void handleSave();
        }}
        onReconcile={
          surface?.decision.kind === "block" &&
          surface.decision.reason === "uncertain"
            ? () => {
                void handleReconcile();
              }
            : undefined
        }
        onRestoreFocus={handleRestoreFocus}
      />
    </AuthoringExitContext.Provider>
  );
}
