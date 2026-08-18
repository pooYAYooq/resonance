import type { Metadata } from "next";
import { DraftsContent } from "./_components/DraftsContent";

export const metadata: Metadata = {
  title: "Drafts",
  description: "Your unpublished posts.",
  robots: { index: false, follow: false },
};

export default function DraftsRoute() {
  return (
    <div className="py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Drafts</h1>
        <p className="mt-2 text-muted-foreground">
          Keep unfinished ideas close until they are ready to publish.
        </p>
      </header>
      <DraftsContent />
    </div>
  );
}
