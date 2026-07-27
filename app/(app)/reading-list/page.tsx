/**
 * Reading List page — the current user's private bookmarked posts.
 *
 * Server Component shell: static metadata (private surface, noindex).
 * The auth gate and the live paginated list live in the client
 * `ReadingListContent`, which mirrors `/create`'s auth gate and
 * `ProfilePostList`'s paginated grid.
 *
 * Bare server-side `fetchQuery` in this repo runs unauthenticated
 * (see the 1.5 spec's "Discovered limitation"), so the page cannot
 * server-gate via `getCurrentUser`; the client gate is authoritative.
 */

import type { Metadata } from "next";
import { ReadingListContent } from "./_components/ReadingListContent";

export const metadata: Metadata = {
  title: "Reading List",
  description: "Posts you've saved to read later.",
  robots: { index: false, follow: false },
};

export default function ReadingListRoute() {
  return (
    <div className="py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Reading List
        </h1>
        <p className="text-muted-foreground mt-2">
          Posts you&apos;ve saved to read later.
        </p>
      </header>
      <ReadingListContent />
    </div>
  );
}
