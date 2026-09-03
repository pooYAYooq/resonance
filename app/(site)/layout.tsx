import type { ReactNode } from "react";
import { SiteShell } from "@/components/web/SiteShell";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell footer="compact">{children}</SiteShell>;
}
