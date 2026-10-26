"use client";

import { useRef, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NotificationsList } from "@/app/(site)/notifications/_components/NotificationsList";
import { ArrowLeft, Bell } from "lucide-react";

/** Auth-only inbox. Opening it never navigates or marks notifications read. */
export function NotificationBell() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [open, setOpen] = useState(false);
  const navigating = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const unread = useQuery(
    api.notifications.getUnreadCount,
    !isLoading && isAuthenticated ? {} : "skip",
  );

  if (!isAuthenticated || isLoading) return null;

  const count = unread ?? 0;
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        navigating.current = false;
        setOpen(nextOpen);
      }}
    >
      <SheetTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={label}
        >
          <Bell />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold leading-none">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        data-notification-drawer=""
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-[48rem]"
        onCloseAutoFocus={(event) => {
          // Destination links manage their own scroll/focus; closing normally
          // returns focus to the bell without moving the underlying page.
          event.preventDefault();
          if (!navigating.current)
            triggerRef.current?.focus({ preventScroll: true });
        }}
      >
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
          // Let the link prepare navigation before closing the drawer. Its
          // destination uses normal routing; capture-phase close loses the link.
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            const target = event.target;
            const link =
              target instanceof Element ? target.closest("a[href]") : null;
            if (
              !link ||
              link.hasAttribute("download") ||
              (link.getAttribute("target") &&
                link.getAttribute("target") !== "_self")
            )
              return;
            navigating.current = true;
            setOpen(false);
          }}
        >
          {open && (
            <NotificationsList
              header={
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close notifications"
                    onClick={() => setOpen(false)}
                  >
                    <ArrowLeft aria-hidden="true" className="size-6" />
                  </Button>
                  <SheetTitle className="text-xl font-semibold">
                    Notifications
                  </SheetTitle>
                </>
              }
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
