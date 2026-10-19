/**
 * Client component for the authenticated, paginated notifications list.
 *
 * Mirrors `ReadingListContent`'s pattern:
 *  - `useConvexAuth` gate: loading spinner while auth is resolving,
 *    redirect to `/auth/login` when not authenticated.
 *  - `usePaginatedQuery(api.notifications.getNotifications)` for the
 *    "Load More" affordance.
 *  - "Load More" button when `status === "CanLoadMore"`.
 *  - `EmptyState` when the visible page is empty, with a Discover
 *    recovery action (the recorded accessibility handoff).
 *
 * Read state is per row and persistent. Visiting the page changes
 * nothing; opening a notification's post calls
 * `api.notifications.markRead` for that row, and the `Mark all read`
 * action reuses `api.notifications.markAllRead` while
 * `api.notifications.getUnreadCount` reports unread rows. Both the
 * desktop bell and the mobile navigation count follow that same
 * query. Rows are never deleted here; they remain as visual history.
 *
 * The list body only renders; the page-level `<h1>Notifications</h1>`
 * lives in `app/(site)/notifications/page.tsx` (mirroring
 * `ReadingListContent`). The UI filters rows whose `postTitle === null`
 * (the post was deleted between fan-out and list read) before
 * rendering, so the user never sees a row with no title.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EmptyState } from "@/components/web/EmptyState";
import { Button } from "@/components/ui/button";
import { Bell, Loader2 } from "lucide-react";
import { NotificationRow, type NotificationRowData } from "./NotificationRow";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";
import { useListFocusRestore } from "@/lib/use-list-focus-restore";

export function NotificationsList() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [markAllPending, setMarkAllPending] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
    }
  }, [isLoading, isAuthenticated, router]);

  const queryArgs = !isLoading && isAuthenticated ? {} : "skip";

  const unreadCount =
    useQuery(api.notifications.getUnreadCount, queryArgs) ?? 0;

  const {
    results,
    status,
    loadMore,
    isLoading: listLoading,
  } = usePaginatedQuery(api.notifications.getNotifications, queryArgs, {
    initialNumItems: 12,
  });

  const rootRef = useRef<HTMLDivElement>(null);
  useListFocusRestore(rootRef, "article", listLoading);

  const handleOpenPost = (notificationId: Id<"notifications">) => {
    void markRead({ notificationId }).catch(() => {
      // Fire-and-forget: a failed mark leaves the row unread, and
      // opening the post again retries.
    });
  };

  const handleMarkAllRead = () => {
    if (markAllPending) return;
    setMarkAllPending(true);
    void markAllRead({})
      .then(() => {
        // The action unmounts once the count reaches zero, so land focus
        // on the named list region instead of an arbitrary row.
        setMarkAllPending(false);
        rootRef.current?.focus();
      })
      .catch(() => {
        // Keep the action visible so the user can retry.
        setMarkAllPending(false);
      });
  };

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

  const markAllReadAction =
    unreadCount > 0 || markAllPending ? (
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          disabled={markAllPending}
        >
          Mark all read
        </Button>
      </div>
    ) : null;

  if (!listLoading && visible.length === 0 && status !== "CanLoadMore") {
    return (
      <div className="space-y-2">
        {markAllReadAction}
        <div
          ref={rootRef}
          role="region"
          aria-label="Notifications list"
          tabIndex={-1}
          className="focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="When an author you follow publishes a new post, it'll show up here."
            action={
              <Button asChild variant="outline">
                <Link href="/blog">Discover</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!listLoading && visible.length === 0 && status === "CanLoadMore") {
    return (
      <div className="space-y-2">
        {markAllReadAction}
        <div
          ref={rootRef}
          role="region"
          aria-label="Notifications list"
          tabIndex={-1}
          className="flex justify-center py-4 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Button variant="outline" onClick={() => loadMore(12)}>
            Load more
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {markAllReadAction}

      <div
        ref={rootRef}
        role="region"
        aria-label="Notifications list"
        tabIndex={-1}
        className="space-y-2 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        {visible.map((notification) => (
          <NotificationRow
            key={notification._id}
            notification={notification}
            onOpenPost={handleOpenPost}
          />
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
    </div>
  );
}
