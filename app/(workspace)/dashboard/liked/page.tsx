import type { Metadata } from "next";
import { LikedSection } from "./_components/LikedSection";

export const metadata: Metadata = {
  title: "Liked posts",
  description: "Posts that resonated with you, most recently liked first.",
};

export default function DashboardLikedRoute() {
  return (
    <section
      aria-labelledby="liked-posts-title"
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10"
    >
      <header className="flex flex-col gap-2">
        <h1
          id="liked-posts-title"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          <span className="sm:hidden">Liked</span>
          <span className="hidden sm:inline">Liked posts</span>
        </h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Posts that resonated with you, most recently liked first.
        </p>
      </header>
      <LikedSection />
    </section>
  );
}
