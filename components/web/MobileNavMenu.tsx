"use client";

import Link from "next/link";
import { useRef, useState, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import {
  BarChart3,
  Bell,
  Bookmark,
  Compass,
  FileText,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  NotebookPen,
  PenLine,
  Rss,
  Settings,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Separator } from "../ui/separator";
import { signOutUser } from "./account-actions";
import { useOptionalAuthoringExit } from "./AuthoringExitProvider";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";

const writingLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "New Post", icon: PenLine },
  { href: "/dashboard/drafts", label: "Drafts", icon: NotebookPen },
  { href: "/dashboard/published", label: "My Posts", icon: FileText },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

const readingLinks = [
  { href: "/blog", label: "Discover", icon: Compass },
  { href: "/feed", label: "Feed", icon: Rss },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/liked", label: "Liked", icon: Heart },
];

export function MobileNavMenu({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          className="size-11 md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="data-[side=right]:w-[min(360px,100%)] gap-0"
      >
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <AppNavigation
          isAuthenticated={isAuthenticated}
          onNavigate={() => setOpen(false)}
          returnFocusRef={triggerRef}
        />
      </SheetContent>
    </Sheet>
  );
}

/** Shared destinations and account controls for the drawer and workspace sidebar. */
export function AppNavigation({
  isAuthenticated,
  onNavigate,
  returnFocusRef,
}: {
  isAuthenticated: boolean;
  onNavigate?: () => void;
  /**
   * Focus target that survives the owner's close. Owners whose trigger stays
   * mounted pass it here; otherwise focus returns to the clicked control.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const exit = useOptionalAuthoringExit();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const unread = useQuery(
    api.notifications.getUnreadCount,
    isAuthenticated ? {} : "skip",
  );
  const close = () => onNavigate?.();
  const linkClass =
    "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted";
  const sectionClass =
    "px-3 text-xs font-medium tracking-wide text-muted-foreground";
  function navLink({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: LucideIcon;
  }) {
    const active = pathname === href;
    return (
      <Link
        key={href}
        className={cn(linkClass, active && "bg-muted text-foreground")}
        href={href}
        onClick={close}
        aria-current={active ? "page" : undefined}
      >
        <Icon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        {label}
      </Link>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
      {isAuthenticated && user && (
        <Link
          href={`/u/${user.userId}`}
          onClick={close}
          className="flex min-w-0 items-center gap-3 rounded-lg bg-muted/50 p-3"
          aria-label={`View profile for ${user.displayName}`}
        >
          <UserAvatar
            userId={user.userId}
            name={user.displayName}
            avatarUrl={user.avatarUrl}
            className="size-11 shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold capitalize">
              {user.displayName}
            </p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">View profile</p>
          </div>
        </Link>
      )}
      {isAuthenticated && (
        <nav aria-label="Writing" className="flex flex-col gap-1">
          <p className={sectionClass}>Writing</p>
          {writingLinks.map(navLink)}
        </nav>
      )}
      <nav aria-label="Reading" className="flex flex-col gap-1">
        <p className={sectionClass}>Reading</p>
        {!isAuthenticated && navLink({ href: "/", label: "Home", icon: Home })}
        {(isAuthenticated ? readingLinks : readingLinks.slice(0, 1)).map(
          navLink,
        )}
      </nav>
      <Separator />
      <nav aria-label="Account" className="flex flex-col gap-1">
        <p className={sectionClass}>Account</p>
        {isAuthenticated ? (
          <>
            <Link className={linkClass} href="/notifications" onClick={close}>
              <Bell
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex-1">Notifications</span>
              {(unread ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  {unread} unread
                </span>
              )}
            </Link>
            {user &&
              navLink({
                href: `/u/${user.userId}`,
                label: "Profile",
                icon: User,
              })}
            {navLink({ href: "/settings", label: "Settings", icon: Settings })}
            <Button
              variant="ghost"
              className="min-h-11 justify-start gap-3 px-3"
              onClick={(event) => {
                const returnFocus =
                  returnFocusRef?.current ?? event.currentTarget;
                close();
                if (exit)
                  exit.requestSignOut(() => signOutUser(router), returnFocus);
                else void signOutUser(router);
              }}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign Out
            </Button>
          </>
        ) : (
          <>
            <Link className={linkClass} href="/auth/login" onClick={close}>
              Log In
            </Link>
            <Link className={linkClass} href="/auth/sign-up" onClick={close}>
              Sign Up
            </Link>
          </>
        )}
      </nav>
      <Separator />
      <div role="group" aria-label="Theme" className="flex flex-col gap-3">
        <p className={sectionClass}>Appearance</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={theme === value ? "default" : "outline"}
              aria-pressed={theme === value}
              className="min-h-11 gap-1.5 px-2"
              onClick={() => setTheme(value)}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
