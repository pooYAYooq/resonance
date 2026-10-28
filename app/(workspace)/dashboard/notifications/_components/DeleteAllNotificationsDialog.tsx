"use client";

import { useState } from "react";
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
import type { DismissScope } from "@/convex/notifications";

export type NotificationCounts = {
  total: number;
  read: number;
  unread: number;
  truncated: boolean;
};

type DeleteAllNotificationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: NotificationCounts;
  onConfirm: (scope: DismissScope) => void;
};

const SCOPES: Array<{ value: DismissScope; label: string }> = [
  { value: "all", label: "All" },
  { value: "read", label: "Read only" },
  { value: "unread", label: "Unread only" },
];

function formatCount(count: number, truncated: boolean): string {
  return truncated ? `${count}+` : String(count);
}

function countForScope(
  counts: NotificationCounts,
  scope: DismissScope,
): number {
  return scope === "all"
    ? counts.total
    : scope === "read"
      ? counts.read
      : counts.unread;
}

function initialScope(counts: NotificationCounts): DismissScope {
  const offered = SCOPES.filter(
    (option) => counts.truncated || countForScope(counts, option.value) > 0,
  );
  return (
    (["read", "unread", "all"] as const).find((value) =>
      offered.some((option) => option.value === value),
    ) ?? "all"
  );
}

export function DeleteAllNotificationsDialog(
  props: DeleteAllNotificationsDialogProps,
) {
  return (
    <DeleteAllNotificationsDialogBody
      key={props.open ? "open" : "closed"}
      {...props}
    />
  );
}

function DeleteAllNotificationsDialogBody({
  open,
  onOpenChange,
  counts,
  onConfirm,
}: DeleteAllNotificationsDialogProps) {
  const [selectedScope, setSelectedScope] = useState<DismissScope>(() =>
    initialScope(counts),
  );
  const offeredScopes = SCOPES.filter(
    (option) =>
      counts.truncated ||
      countForScope(counts, option.value) > 0 ||
      option.value === selectedScope,
  );
  const selectedEmpty =
    !counts.truncated && countForScope(counts, selectedScope) === 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all notifications?</AlertDialogTitle>
          <AlertDialogDescription>
            Choose which notifications to delete. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div role="radiogroup" aria-label="Delete scope" className="grid gap-2">
          {offeredScopes.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="delete-scope"
                  value={option.value}
                  checked={selectedScope === option.value}
                  tabIndex={selectedScope === option.value ? 0 : -1}
                  onChange={() => setSelectedScope(option.value)}
                  className="size-4 accent-foreground"
                />
                <span>{option.label}</span>
              </span>
              <span className="text-muted-foreground">
                {formatCount(
                  countForScope(counts, option.value),
                  counts.truncated,
                )}
              </span>
            </label>
          ))}
        </div>
        {selectedEmpty && (
          <p role="status" className="text-sm text-muted-foreground">
            That group is empty. Choose another scope.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={selectedEmpty}
            onClick={() => onConfirm(selectedScope)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
