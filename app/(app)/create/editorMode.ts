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

/**
 * Determines the editor mode based on URL parameters.
 *
 * @param params - Object containing optional draftId and editPostId
 * @returns Editor mode result indicating new, draft, published-edit, or invalid
 */
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

/**
 * Returns the available capabilities for a given editor mode.
 *
 * @param mode - The current editor mode
 * @returns Object indicating which actions are permitted in this mode
 */
export function getEditorCapabilities(mode: EditorMode): EditorCapabilities {
  return mode === "published-edit"
    ? { canSaveDraft: false, canPublish: false, canUpdate: true }
    : { canSaveDraft: true, canPublish: true, canUpdate: false };
}
