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

type EditorAbandonDialogProps = {
  mode: "start-fresh" | "cancel-update";
  open: boolean;
  blocked: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRestoreFocus: () => void;
};

export function EditorAbandonDialog({
  mode,
  open,
  blocked,
  error,
  onCancel,
  onConfirm,
  onRestoreFocus,
}: EditorAbandonDialogProps) {
  const fresh = mode === "start-fresh";
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <AlertDialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {fresh ? "Start fresh?" : "Discard your changes?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {fresh
              ? "Unsaved changes will be lost. Saved drafts and posts stay."
              : "Only unsaved changes will be lost. You’ll return to My Posts."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {blocked && (
          <p role="status">
            Wait for the current save or upload to finish before continuing.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">
            {fresh ? "Cancel" : "Keep editing"}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            className="min-h-11"
            disabled={blocked}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {fresh ? "Start fresh" : "Discard changes"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
