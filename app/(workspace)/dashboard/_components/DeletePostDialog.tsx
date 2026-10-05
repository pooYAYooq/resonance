"use client";

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

type DeletePostDialogProps = {
  title: string;
  kind?: "published" | "draft";
  open: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRestoreFocus: () => void;
};

export function DeletePostDialog({
  title,
  kind = "published",
  open,
  pending,
  error,
  onCancel,
  onConfirm,
  onRestoreFocus,
}: DeletePostDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onCancel();
      }}
    >
      <AlertDialogContent
        className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto"
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {kind === "draft" ? "Delete draft?" : "Delete published post?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="wrap-anywhere">
            {kind === "draft"
              ? `Permanently delete “${title}”? This draft will be removed. This cannot be undone.`
              : `Permanently delete “${title}”? The post and its associated discussion and engagement will be removed. This cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            disabled={pending}
            className="text-destructive hover:border-destructive! hover:bg-destructive! hover:text-management-delete-foreground!"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending
              ? "Deleting…"
              : kind === "draft"
                ? "Delete Draft"
                : "Delete Post"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
