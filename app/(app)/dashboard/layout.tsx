import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardShell } from "./_components/DashboardShell";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your private author workspace.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
