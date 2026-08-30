/**
 * NotificationBell — self-subscribing bell with unread badge for the
 * Navbar. Mirrors the self-contained pattern of `BookmarkButton` and
 * `FollowButton`: each owns its `useQuery` call so the bell renders
 * correctly after authentication resolves in every auth context.
 *
 * Auth gate: hidden when unauthenticated OR while auth is loading
 * (matches the existing `Create` link and `Reading List` entry's
 * auth-gated render). The bell is a presentational-only renderer of
 * the `getUnreadCount` query — no mutation here, mark-all-read lives
 * on the `/notifications` page mount.
 *
 * Badge: a destructively-styled round chip with the count, hidden
 * when count is 0, capped at "99+" for display (the underlying
 * `users.unreadNotificationCount` keeps the real number for
 * accuracy). Click navigates to `/notifications` via `useRouter`.
 */

"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const unread = useQuery(
    api.notifications.getUnreadCount,
    !isLoading && isAuthenticated ? {} : "skip",
  );

  if (!isAuthenticated || isLoading) return null;

  const count = unread ?? 0;
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={() => router.push("/notifications")}
    >
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}
