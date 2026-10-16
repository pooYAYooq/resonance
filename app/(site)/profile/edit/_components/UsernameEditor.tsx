/**
 * Dedicated username editor for `/profile/edit`.
 *
 * Owns its own draft, availability feedback, confirmation, and save so a
 * three-month commitment is never submitted by the page-header Save. Local
 * formatting errors track the live draft immediately. Non-styling saves wait
 * for a resolved availability classification of the current target, after a
 * typing pause; capitalization-only edits can save immediately without lookup.
 *
 * Like the identity form, it follows the reactive revision prop: a clean draft
 * adopts another tab's saved username silently, while a dirty draft keeps the
 * typing and exposes an explicit reload action.
 */

"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { normalizeUsername } from "@/lib/username";
import {
  CircleCheck,
  CircleX,
  Clock,
  History,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "./useDebouncedValue";

const AVAILABILITY_DEBOUNCE_MS = 350;

const CONFLICT_MESSAGE =
  "Another change saved first. Loading the saved username will replace your unsaved change.";

export type UsernameEditorProps = {
  userId: string;
  initialUsername: string | null;
  revision: number;
  newClaimAllowed: boolean;
  newClaimRetryAfterMs: number;
};

type Availability =
  | { status: "invalid"; message: string }
  | { status: "taken" }
  | { status: "current" }
  | { status: "owned" }
  | { status: "available" };

type ClaimClassification = "owned" | "new";

type StatusKind =
  | "checking"
  | "available"
  | "unclaimable"
  | "current"
  | "owned"
  | "taken";

const STATUS_ICONS: Record<StatusKind, LucideIcon> = {
  checking: Loader2,
  available: CircleCheck,
  unclaimable: Clock,
  current: CircleCheck,
  owned: History,
  taken: CircleX,
};

/** A remaining wait as a locale date and time, so it never implies midnight. */
function formatEligibility(retryAfterMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(Date.now() + retryAfterMs));
}

export function UsernameEditor({
  userId,
  initialUsername,
  revision,
  newClaimAllowed,
  newClaimRetryAfterMs,
}: UsernameEditorProps) {
  const claimUsername = useMutation(api.usernames.claimUsername);
  const [savedUsername, setSavedUsername] = useState(initialUsername);
  const [savedRevision, setSavedRevision] = useState(revision);
  const [draft, setDraft] = useState(initialUsername ?? "");
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    target: string;
    classification: ClaimClassification;
  } | null>(null);
  const [usernameConflict, setUsernameConflict] = useState(false);
  const [processedRevision, setProcessedRevision] = useState(revision);

  // Format validation is immediate; only availability is debounced.
  const live = normalizeUsername(draft);
  const debounced = useDebouncedValue(draft, AVAILABILITY_DEBOUNCE_MS);
  const debouncedNormalized = normalizeUsername(debounced);
  const rawAvailability = useQuery(
    api.usernames.checkUsernameAvailability,
    debouncedNormalized.ok ? { username: debouncedNormalized.styled } : "skip",
  ) as Availability | undefined;
  // A result describes the debounced spelling. Apply it to the current draft
  // only when both spellings are valid and share a canonical form; otherwise
  // the availability is stale and left unknown.
  const availability =
    live.ok &&
    debouncedNormalized.ok &&
    live.canonical === debouncedNormalized.canonical
      ? rawAvailability
      : undefined;

  // Adopt a newer saved revision only while the draft is clean; a dirty draft
  // keeps its typing and flags a conflict for an explicit reload. Setting state
  // during render (as the identity form does) avoids a stale dirty frame.
  if (revision !== processedRevision && !pending) {
    setProcessedRevision(revision);
    if (revision > savedRevision) {
      if (draft === (savedUsername ?? "")) {
        setSavedUsername(initialUsername);
        setSavedRevision(revision);
        setDraft(initialUsername ?? "");
        setUsernameConflict(false);
      } else {
        setUsernameConflict(true);
      }
    }
  }

  const localError = live.ok ? null : live.message;
  const savedCanonical = (savedUsername ?? "").toLowerCase();
  const isUnchanged = live.ok && live.styled === savedUsername;
  const isStylingOnly = live.ok && live.canonical === savedCanonical;
  const isOwned = availability?.status === "owned";
  const isBlocked = availability?.status === "taken";
  const classification: ClaimClassification | null = isOwned
    ? "owned"
    : availability?.status === "available"
      ? "new"
      : null;
  const canSave =
    live.ok &&
    !pending &&
    !isUnchanged &&
    !isBlocked &&
    (isStylingOnly ||
      classification === "owned" ||
      (classification === "new" && newClaimAllowed));

  function requestSave() {
    if (!canSave || !live.ok) return;
    setSaveError(null);
    // Capitalization-only edits skip confirmation; they neither consume nor
    // reset the new-name allowance.
    if (isStylingOnly) {
      void submit(live.styled);
      return;
    }
    // Keep the reviewed target and its copy together even if the advisory
    // query updates while the dialog is open. The mutation rechecks both.
    if (classification !== null) {
      setConfirmation({ target: live.styled, classification });
    }
  }

  function handleReload() {
    setSavedUsername(initialUsername);
    setSavedRevision(revision);
    setDraft(initialUsername ?? "");
    setProcessedRevision(revision);
    setUsernameConflict(false);
    setSaveError(null);
    setConfirmation(null);
  }

  async function submit(username: string) {
    setPending(true);
    try {
      const result = await claimUsername({
        username,
        expectedRevision: savedRevision,
      });
      if (result.kind === "saved") {
        setSavedUsername(result.username);
        setSavedRevision(result.revision);
        setDraft(result.username);
        setConfirmation(null);
        setSaveError(null);
        setUsernameConflict(false);
        toast.success("Username updated");
        return;
      }
      setConfirmation(null);
      if (result.kind === "conflict") {
        setUsernameConflict(true);
        return;
      }
      if (result.kind === "cooldown") {
        setSaveError("You cannot claim a new username yet.");
        return;
      }
      // A concurrent claim won the name: preserve the draft so the person can
      // choose again, with the same neutral unavailable message.
      setSaveError("Username unavailable.");
    } catch (error) {
      setConfirmation(null);
      const data = (error as { data?: { message?: string } }).data;
      setSaveError(data?.message ?? "Failed to save your username. Try again.");
    } finally {
      setPending(false);
    }
  }

  const status: { kind: StatusKind; text: string } | null = isBlocked
    ? { kind: "taken", text: "Username unavailable." }
    : availability?.status === "available"
      ? newClaimAllowed
        ? { kind: "available", text: "Available." }
        : {
            kind: "unclaimable",
            text: "Available, but you cannot claim a new name yet.",
          }
      : availability?.status === "current"
        ? { kind: "current", text: "This is your current username." }
        : isOwned
          ? {
              kind: "owned",
              text: "This is one of your previous usernames.",
            }
          : live.ok && !isUnchanged && availability === undefined
            ? { kind: "checking", text: "Checking availability..." }
            : null;
  const StatusIcon = status ? STATUS_ICONS[status.kind] : null;

  const allowanceWaitText = useMemo(
    () =>
      `You can claim a new username after your 90-day wait ends on ${formatEligibility(
        newClaimRetryAfterMs,
      )}.`,
    [newClaimRetryAfterMs],
  );
  const defaultDescription = newClaimAllowed
    ? "You can claim a new username now."
    : allowanceWaitText;
  // The wait line is always visible when the allowance is spent, even while a
  // status line occupies the primary description.
  const showAllowanceDate = !newClaimAllowed && status !== null;
  const errorText = saveError ?? localError;
  const inputId = `username-${userId}`;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;

  return (
    <Field data-invalid={Boolean(errorText) || undefined}>
      <FieldLabel htmlFor={inputId}>Username</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={inputId}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaveError(null);
          }}
          placeholder="Choose a username"
          className="min-w-0 flex-1"
          aria-invalid={Boolean(errorText) || undefined}
          aria-describedby={errorText ? `${helpId} ${errorId}` : helpId}
        />
        <Button
          type="button"
          disabled={!canSave}
          onClick={requestSave}
          className="cursor-pointer"
        >
          Save username
        </Button>
      </div>
      <FieldDescription
        id={helpId}
        className="flex items-center gap-1.5 text-left"
      >
        {StatusIcon && (
          <StatusIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0",
              status?.kind === "checking" && "animate-spin",
            )}
          />
        )}
        <span>{status ? status.text : defaultDescription}</span>
      </FieldDescription>
      {showAllowanceDate && (
        <FieldDescription>{allowanceWaitText}</FieldDescription>
      )}
      <div className="min-h-5">
        {errorText && <FieldError id={errorId}>{errorText}</FieldError>}
      </div>

      {usernameConflict && (
        <div
          role="alert"
          className="flex flex-col gap-2 text-sm text-destructive"
        >
          <p>{CONFLICT_MESSAGE}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={handleReload}
          >
            Load saved username
          </Button>
        </div>
      )}

      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change your username?</DialogTitle>
            <DialogDescription>
              {confirmation?.classification === "new"
                ? "Claiming a new username starts a 90-day wait before you can claim another. Your previous addresses keep working."
                : "You are switching back to one of your usernames. This does not change your 90-day wait."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {savedUsername ?? ""} to {confirmation?.target}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirmation !== null) void submit(confirmation.target);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Field>
  );
}
