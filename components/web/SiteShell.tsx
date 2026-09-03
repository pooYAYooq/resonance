import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

export function SiteShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer: "compact" | "marketing";
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="w-full flex-1 max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {children}
      </main>
      <Footer variant={footer} />
    </div>
  );
}
