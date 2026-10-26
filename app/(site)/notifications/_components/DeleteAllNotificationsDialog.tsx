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
  const [selectedScope, setSelectedScope] = useState<DismissScope | null>(null);
  const countFor = (value: DismissScope) =>
    value === "all"
      ? counts.total
      : value === "read"
        ? counts.read
        : counts.unread;
  const offeredScopes = SCOPES.filter(
    (option) => counts.truncated || countFor(option.value) > 0,
  );
  const defaultScope =
    (["read", "unread", "all"] as const).find((value) =>
      offeredScopes.some((option) => option.value === value),
    ) ?? "all";
  const scope =
    selectedScope &&
    offeredScopes.some((option) => option.value === selectedScope)
      ? selectedScope
      : defaultScope;

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
                  checked={scope === option.value}
                  tabIndex={scope === option.value ? 0 : -1}
                  onChange={() => setSelectedScope(option.value)}
                  className="size-4 accent-foreground"
                />
                <span>{option.label}</span>
              </span>
              <span className="text-muted-foreground">
                {formatCount(countFor(option.value), counts.truncated)}
              </span>
            </label>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => onConfirm(scope)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
