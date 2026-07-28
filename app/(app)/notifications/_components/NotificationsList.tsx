/**
 * Client component for the authenticated, paginated notifications list.
 *
 * Mirrors `ReadingListContent`'s pattern:
 *  - `useConvexAuth` gate: loading spinner while auth is resolving,
 *    redirect to `/auth/login` when not authenticated.
 *  - `usePaginatedQuery(api.notifications.getNotifications)` for the
 *    "Load More" affordance.
 *  - "Load More" button when `status === "CanLoadMore"`.
 *  - `EmptyState` when the visible page is empty.
 *
 * Renders one `NotificationRow` per hydrated notification. The
 * page-level `<h1>Notifications</h1>` lives in
 * `app/(app)/notifications/page.tsx` (this component is the list
 * body only, mirroring `ReadingListContent`). Calls
 * `useMutation(api.notifications.markAllRead)` exactly once on mount
 * via `useEffect`. The mutation is fire-and-forget; the bell badge
 * drops to 0 reactively through the `getUnreadCount` subscription.
 * The list rows are NOT deleted on mark-all-read — they remain as
 * visual history. The UI filters out rows whose `postTitle === null`
 * (the post was deleted between fan-out and list read) before
 * rendering, so the user never sees a row with no title.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/web/EmptyState";
import { Button } from "@/components/ui/button";
import { Bell, Loader2 } from "lucide-react";
import { NotificationRow, type NotificationRowData } from "./NotificationRow";

export function NotificationsList() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const markAllRead = useMutation(api.notifications.markAllRead);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void markAllRead({}).catch(() => {
        // Fire-and-forget: a failure here is non-fatal — the user can
        // re-visit the page to retry, and the row data still renders.
      });
    }
    // markAllRead is a stable Convex mutation reference; we want the
    // effect to run exactly once on auth, so we omit it from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const queryArgs = isAuthenticated ? {} : "skip";

  const { results, status, loadMore, isLoading: listLoading } =
    usePaginatedQuery(
      api.notifications.getNotifications,
      queryArgs,
      { initialNumItems: 12 },
    );

  if (isLoading || !isAuthenticated) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin size-8 text-muted-foreground" />
      </div>
    );
  }

  if (listLoading && results.length === 0) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin size-8 text-muted-foreground" />
      </div>
    );
  }

  const visible = results.filter(
    (n): n is NotificationRowData => n.postTitle !== null,
  );

  if (!listLoading && visible.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        description="When an author you follow publishes a new post, it'll show up here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((notification) => (
        <NotificationRow key={notification._id} notification={notification} />
      ))}

      {status === "CanLoadMore" && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={() => loadMore(12)}
            disabled={listLoading}
          >
            {listLoading ? (
              <>
                <Loader2 className="animate-spin size-4" />
                <span className="ml-2">Loading more...</span>
              </>
            ) : (
              <span>Load more</span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
