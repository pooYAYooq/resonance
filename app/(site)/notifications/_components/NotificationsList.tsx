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
 * nothing; expanding a row or opening any of its links calls
 * `api.notifications.markRead` for that row, and the `Mark all as read`
 * action reuses `api.notifications.markAllRead` while
 * `api.notifications.getUnreadCount` reports unread rows. Each row also
 * exposes Delete, which removes the row through
 * `api.notifications.dismiss`. Both the desktop bell and the mobile
 * navigation count follow that same query. Rows are never deleted here
 * except by the reader; they remain as visual history.
 *
 * The list body only renders; the page-level `<h1>Notifications</h1>`
 * lives in `app/(site)/notifications/page.tsx` (mirroring
 * `ReadingListContent`). The UI keeps a defensive filter for rows whose
 * post is unavailable, though the query already drops them.
 */

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
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
import {
  Bell,
  CheckCheck,
  ChevronsDown,
  ChevronsUp,
  Loader2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  setNotificationsExpanded,
  subscribeToExpansion,
  readExpansion,
  notificationExpansionKey,
  collapsedOnServer,
} from "./notificationExpansion";
import { NotificationRow } from "./NotificationRow";
import { DeleteAllNotificationsDialog } from "./DeleteAllNotificationsDialog";
import type { DismissScope } from "@/convex/notifications";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";
import { useListFocusRestore } from "@/lib/use-list-focus-restore";

// Keep pending removals hidden when navigating away and back during Undo.
// A null value keeps a row hidden while its server deletion is committing.
let pendingDismissals = new Map<Id<"notifications">, (() => void) | null>();
const dismissalListeners = new Set<() => void>();
const emptyDismissals = new Map<Id<"notifications">, (() => void) | null>();
const getPendingDismissals = () => pendingDismissals;
const getServerDismissals = () => emptyDismissals;
function subscribeToDismissals(listener: () => void) {
  dismissalListeners.add(listener);
  return () => {
    dismissalListeners.delete(listener);
  };
}
function setPendingDismissal(
  id: Id<"notifications">,
  undo: (() => void) | null | undefined,
) {
  pendingDismissals = new Map(pendingDismissals);
  if (undo === undefined) pendingDismissals.delete(id);
  else pendingDismissals.set(id, undo);
  dismissalListeners.forEach((listener) => listener());
}

export function NotificationsList({
  header,
}: {
  /** Optional drawer header rendered beside the notification controls. */
  header?: ReactNode;
} = {}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const dismiss = useMutation(api.notifications.dismiss);
  const dismissAll = useMutation(api.notifications.dismissAll);
  const [markAllPending, setMarkAllPending] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const hiddenDismissals = useSyncExternalStore(
    subscribeToDismissals,
    getPendingDismissals,
    getServerDismissals,
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
    }
  }, [isLoading, isAuthenticated, router]);

  const queryArgs = !isLoading && isAuthenticated ? {} : "skip";

  const unreadCount =
    useQuery(api.notifications.getUnreadCount, queryArgs) ?? 0;

  const counts = useQuery(
    api.notifications.getNotificationCounts,
    queryArgs,
  ) ?? {
    total: 0,
    read: 0,
    unread: 0,
    truncated: false,
  };

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

  const handleActivate = (notificationId: Id<"notifications">) => {
    void markRead({ notificationId }).catch(() => {
      // Fire-and-forget: a failed mark leaves the row unread, and
      // activating the row again retries.
    });
  };

  const handleDismiss = (notificationId: Id<"notifications">) => {
    if (pendingDismissals.has(notificationId)) return;
    let settled = false;
    const undo = () => {
      if (settled) return;
      settled = true;
      setPendingDismissal(notificationId, undefined);
      toast.dismiss(toastId);
    };
    const commit = () => {
      if (settled) return;
      settled = true;
      setPendingDismissal(notificationId, null);
      void dismiss({ notificationId })
        .catch(() => {
          toast.error("Couldn't delete notification. Please try again.");
        })
        .finally(() => setPendingDismissal(notificationId, undefined));
    };
    setPendingDismissal(notificationId, undo);
    const toastId = toast("Notification deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: undo,
      },
      // Wait until Undo is no longer available before deleting on the server.
      onAutoClose: commit,
      onDismiss: commit,
    });
  };

  const handleDismissAll = (scope: DismissScope) => {
    void dismissAll({ scope }).catch(() => {
      // A failed sweep leaves the rows in place; tell the reader to retry.
      toast.error("Couldn't delete notifications. Please try again.");
    });
  };

  const handleMarkAllRead = () => {
    if (markAllPending) return;
    setMarkAllPending(true);
    void markAllRead({})
      .then(() => {
        // The action stays visible but becomes disabled; land focus on
        // the named list region instead of an arbitrary row.
        setMarkAllPending(false);
        // Let the menu finish restoring focus to its trigger first.
        requestAnimationFrame(() => rootRef.current?.focus());
      })
      .catch(() => {
        // Keep the action visible so the user can retry.
        setMarkAllPending(false);
      });
  };

  const visible = results.filter(
    (n) =>
      (!hiddenDismissals.has(n._id) ||
        (header && hiddenDismissals.get(n._id))) &&
      (n.type === "follow" || n.postTitle !== null),
  );

  const expandable = visible.filter(
    (n) => !hiddenDismissals.has(n._id) && n.type !== "follow",
  );
  const allExpanded = useSyncExternalStore(
    subscribeToExpansion,
    () =>
      expandable.length > 0 &&
      expandable.every((n) => readExpansion(notificationExpansionKey(n))),
    collapsedOnServer,
  );
  const expansionLabel = allExpanded ? "Collapse all" : "Expand all";
  const ExpansionIcon = allExpanded ? ChevronsUp : ChevronsDown;
  const handleToggleAll = () => {
    if (allExpanded) {
      setNotificationsExpanded(expandable, false);
      return;
    }
    setNotificationsExpanded(expandable, true);
  };
  const toolbar = (
    <div
      className={
        header
          ? "sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 bg-popover px-4 py-4"
          : "mb-4 flex w-[44rem] max-w-full flex-wrap items-center justify-between gap-2"
      }
    >
      {header ? (
        <div className="flex min-w-0 items-center gap-2">{header}</div>
      ) : (
        <div className="hidden items-center gap-1 sm:flex">
          <Button
            variant="ghost"
            size="sm"
            disabled={expandable.length === 0}
            onClick={handleToggleAll}
          >
            {expansionLabel}
          </Button>
        </div>
      )}
      <div
        role="group"
        aria-label="Notification controls"
        className="ml-auto flex items-center gap-1"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={expansionLabel}
          className={header ? "hidden sm:inline-flex" : "hidden"}
          disabled={expandable.length === 0}
          onClick={handleToggleAll}
        >
          <ExpansionIcon aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="More notification actions"
            >
              <MoreVertical aria-hidden="true" className="size-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-48 whitespace-nowrap"
          >
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={unreadCount === 0 || markAllPending}
                onSelect={handleMarkAllRead}
              >
                <CheckCheck aria-hidden="true" />
                Mark all as read
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={counts.total === 0}
                onSelect={() => setDeleteAllOpen(true)}
              >
                <Trash2 aria-hidden="true" />
                Delete all
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {deleteAllOpen && (
        <DeleteAllNotificationsDialog
          open={deleteAllOpen}
          onOpenChange={setDeleteAllOpen}
          counts={counts}
          onConfirm={handleDismissAll}
        />
      )}
    </div>
  );

  if (isLoading || !isAuthenticated) {
    return (
      <div className={header ? "" : "space-y-2"}>
        {header ? toolbar : null}
        <div className="py-12 flex justify-center">
          <Loader2 className="animate-spin size-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (listLoading && results.length === 0) {
    return (
      <div className={header ? "" : "space-y-2"}>
        {header ? toolbar : null}
        <div className="py-12 flex justify-center">
          <Loader2 className="animate-spin size-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!listLoading && visible.length === 0 && status !== "CanLoadMore") {
    return (
      <div className={header ? "" : "space-y-2"}>
        {toolbar}
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
            description="Likes, follows, and comments on your work will show up here."
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
      <div className={header ? "" : "space-y-2"}>
        {toolbar}
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
    <div className={header ? "" : "space-y-2"}>
      {toolbar}

      <div
        ref={rootRef}
        role="region"
        aria-label="Notifications list"
        tabIndex={-1}
        className="space-y-2 max-sm:space-y-0 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        {visible.map((notification) => {
          const undo = header
            ? hiddenDismissals.get(notification._id)
            : undefined;
          return undo ? (
            <article
              key={notification._id}
              aria-label="Deleted notification"
              className="flex w-[44rem] max-w-full items-center justify-between gap-3 rounded-sm border border-border px-3 py-2 text-sm"
            >
              <p role="status">Notification deleted</p>
              <Button autoFocus variant="outline" size="sm" onClick={undo}>
                Undo
              </Button>
            </article>
          ) : (
            <NotificationRow
              key={notification._id}
              notification={notification}
              onActivate={handleActivate}
              onDelete={handleDismiss}
            />
          );
        })}

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
