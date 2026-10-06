"use client";

import { createContext, useContext } from "react";

type WorkspacePreviewContextValue = {
  isPreview: boolean;
  setIsPreview: (isPreview: boolean) => void;
};

const WorkspacePreviewContext = createContext<WorkspacePreviewContextValue>({
  isPreview: false,
  setIsPreview: () => {},
});

export const WorkspacePreviewProvider = WorkspacePreviewContext.Provider;

/** Lets workspace content replace the authoring chrome for a temporary preview. */
export function useWorkspacePreview() {
  return useContext(WorkspacePreviewContext);
}
