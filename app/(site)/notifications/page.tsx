/**
 * Notifications page — the current user's private notification feed.
 *
 * Server Component shell: static metadata (private surface, noindex).
 * The auth gate, the live paginated list, and the mark-all-read-on-
 * mount behavior live in the client
 * `_components/NotificationsList`, which mirrors `/create`'s auth
 * gate and `ReadingListContent`'s paginated shape.
 *
 * Bare server-side `fetchQuery` in this repo runs unauthenticated
 * (see the FEATURES.md "Known issue" note), so the page cannot
 * server-gate via `getCurrentUser`; the client gate is authoritative.
 */

import type { Metadata } from "next";
import { NotificationsList } from "./_components/NotificationsList";

export const metadata: Metadata = {
  title: "Notifications",
  description: "New posts from authors you follow.",
  robots: { index: false, follow: false },
};

export default function NotificationsRoute() {
  return (
    <div className="py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Notifications
        </h1>
        <p className="text-muted-foreground mt-2">
          New posts from authors you follow.
        </p>
      </header>
      <NotificationsList />
    </div>
  );
}
