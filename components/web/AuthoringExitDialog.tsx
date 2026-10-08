"use client";

import type { ExitDecision } from "@/lib/authoring-exit-policy";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmRisk = Extract<ExitDecision, { kind: "confirm" }>["risk"];
type BlockReason = Extract<ExitDecision, { kind: "block" }>["reason"];

const CONFIRM_COPY: Record<
  ConfirmRisk,
  { title: string; description: string }
> = {
  unsaved: {
    title: "Leave this page?",
    description: "Save a draft to keep your latest changes.",
  },
  "published-edit": {
    title: "Leave without saving?",
    description: "Your changes will be lost. Your published post won’t change.",
  },
  cover: {
    title: "Leave without saving?",
    description: "Your image changes may be lost. Save before leaving.",
  },
  storage: {
    title: "Your changes aren’t saved",
    description: "Save a draft before leaving to avoid losing your work.",
  },
  abandon: {
    title: "Switch documents?",
    description: "Save your changes first, or switch without saving.",
  },
  "sign-out": {
    title: "Sign out?",
    description: "Save your changes first, or discard them and sign out.",
  },
};

const BLOCK_COPY: Record<BlockReason, { title: string; description: string }> =
  {
    operation: {
      title: "Please wait",
      description: "Your save or upload is still in progress.",
    },
    uncertain: {
      title: "We couldn’t confirm your save",
      description: "Check the status before leaving.",
    },
    loading: {
      title: "Loading your document…",
      description: "Please wait a moment before leaving.",
    },
  };

type AuthoringExitDialogProps = {
  open: boolean;
  decision: ExitDecision;
  pending: boolean;
  error: string | null;
  onStay: () => void;
  onLeave: () => void;
  onSave: () => void;
  onReconcile?: () => void;
  onRestoreFocus?: () => void;
};

/**
 * Accessible light/strong/blocking surface for authoring exits. It renders
 * only the decision it is handed and owns no form, router, or auth state.
 */
export function AuthoringExitDialog({
  open,
  decision,
  pending,
  error,
  onStay,
  onLeave,
  onSave,
  onReconcile,
  onRestoreFocus,
}: AuthoringExitDialogProps) {
  const copy =
    decision.kind === "confirm"
      ? CONFIRM_COPY[decision.risk]
      : decision.kind === "block"
        ? BLOCK_COPY[decision.reason]
        : null;
  if (!copy) return null;

  const risk = decision.kind === "confirm" ? decision.risk : null;
  const saveLabel =
    risk === "sign-out"
      ? "Save & sign out"
      : risk === "abandon"
        ? "Save & switch"
        : "Save & leave";
  const leaveLabel =
    risk === "sign-out"
      ? "Discard & sign out"
      : risk === "abandon"
        ? "Switch"
        : "Leave";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onStay();
      }}
    >
      <AlertDialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto data-[size=default]:sm:max-w-2xl"
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus?.();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter className="sm:flex-wrap">
          <AlertDialogCancel
            className="h-auto min-h-11 whitespace-normal"
            disabled={pending}
          >
            {decision.kind === "confirm"
              ? "Cancel"
              : decision.kind === "block" && decision.reason === "uncertain"
                ? "Keep editing"
                : "Stay here"}
          </AlertDialogCancel>
          {decision.kind === "confirm" && (
            <>
              <AlertDialogAction
                variant={
                  decision.risk === "sign-out" ? "destructive" : "outline"
                }
                className="h-auto min-h-11 whitespace-normal"
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  onLeave();
                }}
              >
                {leaveLabel}
              </AlertDialogAction>
              {decision.canSaveDraft && (
                <AlertDialogAction
                  className="h-auto min-h-11 whitespace-normal"
                  disabled={pending}
                  onClick={(event) => {
                    event.preventDefault();
                    onSave();
                  }}
                >
                  {pending ? "Saving…" : saveLabel}
                </AlertDialogAction>
              )}
            </>
          )}
          {decision.kind === "block" &&
            decision.reason === "uncertain" &&
            onReconcile && (
              <AlertDialogAction
                className="h-auto min-h-11 whitespace-normal"
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  onReconcile();
                }}
              >
                Check status
              </AlertDialogAction>
            )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
