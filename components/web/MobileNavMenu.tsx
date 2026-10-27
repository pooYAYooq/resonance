"use client";

import Link from "next/link";
import { useRef, useState, type ReactElement, type RefObject } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { signOutUser } from "./account-actions";
import { useOptionalAuthoringExit } from "./AuthoringExitProvider";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";
import { buildProfilePath } from "@/lib/username";

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
  { href: "/dashboard/saved", label: "Saved", icon: Bookmark },
  { href: "/dashboard/liked", label: "Liked", icon: Heart },
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
        <SheetHeader className="h-14">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
        </SheetHeader>
        <AppNavigation
          isAuthenticated={isAuthenticated}
          onNavigateAction={() => setOpen(false)}
          returnFocusRef={triggerRef}
        />
      </SheetContent>
    </Sheet>
  );
}

/** Shared destinations and account controls for the drawer and workspace sidebar. */
export function AppNavigation({
  isAuthenticated,
  onNavigateAction,
  returnFocusRef,
  collapsed = false,
}: {
  isAuthenticated: boolean;
  onNavigateAction?: () => void;
  /** Icon-only presentation for the desktop workspace sidebar. */
  collapsed?: boolean;
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
  const close = () => onNavigateAction?.();
  const linkClass = cn(
    "relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    collapsed && "justify-center px-0",
  );
  const sectionClass = cn(
    "px-3 text-xs font-medium tracking-wide text-muted-foreground",
    collapsed && "sr-only",
  );
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
      <NavigationTooltip key={href} collapsed={collapsed} label={label}>
        <Link
          className={cn(linkClass, active && "bg-muted text-foreground")}
          href={href}
          onClick={close}
          aria-current={active ? "page" : undefined}
        >
          <Icon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className={cn(collapsed && "sr-only")}>{label}</span>
        </Link>
      </NavigationTooltip>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6",
        collapsed && "px-3",
      )}
    >
      {isAuthenticated && user?.username && (
        <NavigationTooltip
          collapsed={collapsed}
          label={`View profile for ${user.displayName}`}
        >
          <Link
            href={buildProfilePath(user.username)}
            onClick={close}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-lg bg-muted/50 p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              collapsed && "justify-center bg-transparent p-0",
            )}
            aria-label={`View profile for ${user.displayName}`}
          >
            <UserAvatar
              userId={user.userId}
              name={user.displayName}
              avatarUrl={user.avatarUrl}
              className="size-11 shrink-0"
            />
            <div className={cn("min-w-0", collapsed && "sr-only")}>
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
        </NavigationTooltip>
      )}
      {isAuthenticated && user && !user.username && (
        <div
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-lg bg-muted/50 p-3",
            collapsed && "justify-center bg-transparent p-0",
          )}
        >
          <UserAvatar
            userId={user.userId}
            name={user.displayName}
            avatarUrl={user.avatarUrl}
            className="size-11 shrink-0"
          />
          <div className={cn("min-w-0", collapsed && "sr-only")}>
            <p className="truncate text-sm font-semibold capitalize">
              {user.displayName}
            </p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            )}
          </div>
        </div>
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
            <NavigationTooltip
              collapsed={collapsed}
              label={
                (unread ?? 0) > 0
                  ? `Notifications (${unread} unread)`
                  : "Notifications"
              }
            >
              <Link
                className={linkClass}
                href="/notifications"
                onClick={close}
                aria-label={
                  (unread ?? 0) > 0
                    ? `Notifications ${unread} unread`
                    : "Notifications"
                }
              >
                <Bell
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className={cn("flex-1", collapsed && "sr-only")}>
                  Notifications
                </span>
                {(unread ?? 0) > 0 && (
                  <>
                    <span
                      className={cn(
                        "text-xs text-muted-foreground",
                        collapsed && "sr-only",
                      )}
                    >
                      {unread} unread
                    </span>
                    {collapsed && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 right-2 size-2 rounded-full bg-primary"
                      />
                    )}
                  </>
                )}
              </Link>
            </NavigationTooltip>
            {user?.username &&
              navLink({
                href: buildProfilePath(user.username),
                label: "Profile",
                icon: User,
              })}
            {navLink({ href: "/settings", label: "Settings", icon: Settings })}
            <NavigationTooltip collapsed={collapsed} label="Sign Out">
              <Button
                variant="ghost"
                className={cn(
                  "min-h-11 justify-start gap-3 px-3",
                  collapsed && "justify-center px-0",
                )}
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
                <span className={cn(collapsed && "sr-only")}>Sign Out</span>
              </Button>
            </NavigationTooltip>
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
        <div
          className={cn("grid grid-cols-3 gap-2", collapsed && "grid-cols-1")}
        >
          {(
            [
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <NavigationTooltip
              key={value}
              collapsed={collapsed}
              label={`${label} theme`}
            >
              <Button
                variant={theme === value ? "default" : "outline"}
                aria-pressed={theme === value}
                className="min-h-11 gap-1.5 px-2"
                onClick={() => setTheme(value)}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className={cn(collapsed && "sr-only")}>{label}</span>
              </Button>
            </NavigationTooltip>
          ))}
        </div>
      </div>
    </div>
  );
}

function NavigationTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactElement;
}) {
  if (!collapsed) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
