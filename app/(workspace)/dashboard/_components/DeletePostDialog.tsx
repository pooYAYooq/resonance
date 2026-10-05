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
  open: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRestoreFocus: () => void;
};

export function DeletePostDialog({
  title,
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
          <AlertDialogTitle>Delete published post?</AlertDialogTitle>
          <AlertDialogDescription className="wrap-anywhere">
            Permanently delete “{title}”? The post and its associated discussion
            and engagement will be removed. This cannot be undone.
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
            {pending ? "Deleting…" : "Delete Post"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
