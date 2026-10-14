import type { ReactNode } from "react";
import "flag-icons/css/flag-icons.min.css";
import { SiteShell } from "@/components/web/SiteShell";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell footer="compact">{children}</SiteShell>;
}
