/**
 * Layout for all main app routes (shared Navbar + Footer).
 *
 * Wraps the page in a flex column with `min-h-screen` so the footer is
 * pushed to the bottom even when the content is short. The Navbar is
 * sticky and sits above the main scrollable area; the Footer is placed
 * after the main content and always rendered at the bottom of the page.
 */
import { Footer } from "@/components/web/Footer";
import { Navbar } from "@/components/web/Navbar";
import { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
