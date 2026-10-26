import type { Metadata } from "next";
import { SavedSection } from "./_components/SavedSection";

export const metadata: Metadata = {
  title: "Saved posts",
  description: "Posts you saved to revisit, newest first.",
};

export default function DashboardSavedRoute() {
  return (
    <section
      aria-labelledby="saved-posts-title"
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10"
    >
      <header className="flex flex-col gap-2">
        <h1
          id="saved-posts-title"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          <span className="sm:hidden">Saved</span>
          <span className="hidden sm:inline">Saved posts</span>
        </h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Posts you saved to revisit, newest first.
        </p>
      </header>
      <SavedSection />
    </section>
  );
}
