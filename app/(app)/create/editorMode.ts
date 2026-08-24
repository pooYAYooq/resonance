export type EditorMode = "new" | "draft" | "published-edit" | "invalid";

export type EditorModeResult =
  | { mode: "new"; id: undefined }
  | { mode: "draft" | "published-edit"; id: string }
  | { mode: "invalid" };

export type EditorCapabilities = {
  canSaveDraft: boolean;
  canPublish: boolean;
  canUpdate: boolean;
};

export function resolveEditorMode(params: {
  draftId?: string;
  editPostId?: string;
}): EditorModeResult {
  if (params.draftId && params.editPostId) return { mode: "invalid" };
  if (params.draftId) return { mode: "draft", id: params.draftId };
  if (params.editPostId) {
    return { mode: "published-edit", id: params.editPostId };
  }
  return { mode: "new", id: undefined };
}

export function getEditorCapabilities(mode: EditorMode): EditorCapabilities {
  return mode === "published-edit"
    ? { canSaveDraft: false, canPublish: false, canUpdate: true }
    : { canSaveDraft: true, canPublish: true, canUpdate: false };
}
