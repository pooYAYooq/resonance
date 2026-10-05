import { DraftsSection } from "../_components/DraftsSection";

export default function DashboardDraftsRoute() {
  return (
    <section
      aria-labelledby="drafts-title"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10"
    >
      <header className="flex flex-col gap-2">
        <h1
          id="drafts-title"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Drafts
        </h1>
        <p className="text-sm text-muted-foreground">
          Your unfinished posts, ready to resume.
        </p>
      </header>
      <DraftsSection />
    </section>
  );
}
