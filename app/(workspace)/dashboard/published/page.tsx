import { PublishedSection } from "../_components/PublishedSection";

export default function DashboardPublishedRoute() {
  return (
    <section
      aria-labelledby="my-posts-title"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10"
    >
      <header className="flex flex-col gap-2">
        <h1
          id="my-posts-title"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          My Posts
        </h1>
        <p className="text-sm text-muted-foreground">
          All of your published posts.
        </p>
      </header>
      <PublishedSection />
    </section>
  );
}
