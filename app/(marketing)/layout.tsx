import type { ReactNode } from "react";
import { SiteShell } from "@/components/web/SiteShell";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <SiteShell footer="marketing">{children}</SiteShell>;
}
