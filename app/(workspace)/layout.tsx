import type { ReactNode } from "react";
import { WorkspaceShell } from "./_components/WorkspaceShell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
