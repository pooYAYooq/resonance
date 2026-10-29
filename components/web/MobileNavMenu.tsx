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
  ChevronRight,
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
  { href: "/dashboard/drafts", label: "Drafts", icon: NotebookPen },
  { href: "/dashboard/published", label: "My Posts", icon: FileText },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

const readingLinks = [
  { href: "/dashboard/feed", label: "Feed", icon: Rss },
  { href: "/blog", label: "Blog", icon: Compass },
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
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-none gap-0"
      >
        <SheetHeader className="h-14 justify-center pr-16">
          <SheetTitle className="text-xl font-extrabold">
            <Link
              href={isAuthenticated ? "/dashboard" : "/"}
              onClick={() => setOpen(false)}
            >
              RESONANCE
            </Link>
          </SheetTitle>
        </SheetHeader>
        <AppNavigation
          isAuthenticated={isAuthenticated}
          workspaceMode={isAuthenticated}
          mobileDrawer
          showNotifications={false}
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
  workspaceMode = false,
  mobileDrawer = false,
  showNotifications = true,
}: {
  isAuthenticated: boolean;
  onNavigateAction?: () => void;
  /** Icon-only presentation for the desktop workspace sidebar. */
  collapsed?: boolean;
  workspaceMode?: boolean;
  mobileDrawer?: boolean;
  showNotifications?: boolean;
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
    isAuthenticated && showNotifications ? {} : "skip",
  );
  const close = () => onNavigateAction?.();
  const linkClass = cn(
    "relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    collapsed && "justify-center px-0",
    workspaceMode && "text-muted-foreground dark:hover:bg-muted/50",
    workspaceMode && !collapsed && "pl-[8.5px]",
    mobileDrawer && "min-h-12 text-base",
  );
  const sectionClass = cn(
    "px-3 text-xs font-medium tracking-wide text-muted-foreground",
    collapsed && "sr-only",
    mobileDrawer && "text-sm",
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
          <span
            className={cn(
              "flex shrink-0 items-center justify-center",
              workspaceMode && "size-5",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 text-muted-foreground",
                workspaceMode && active && "text-foreground",
                mobileDrawer && "size-5",
              )}
              aria-hidden="true"
            />
          </span>
          <span className={cn(collapsed && "sr-only")}>{label}</span>
        </Link>
      </NavigationTooltip>
    );
  }

  const profile = (
    <>
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
    </>
  );

  const mobileIdentity = user && (
    <>
      <UserAvatar
        userId={user.userId}
        name={user.displayName}
        avatarUrl={user.avatarUrl}
        className="size-10 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium">{user.displayName}</p>
        <p className="text-sm text-muted-foreground">
          {user.username ? "View profile" : "Set up your profile"}
        </p>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </>
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-4 pb-6",
        workspaceMode && !collapsed && "px-2",
        collapsed && "px-1",
        mobileDrawer && "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
      )}
    >
      {!workspaceMode && profile}
      {workspaceMode && mobileDrawer && isAuthenticated && (
        <div className="flex flex-col gap-2">
          {user && (
            <Link
              href={
                user.username
                  ? buildProfilePath(user.username)
                  : "/profile/edit"
              }
              onClick={close}
              aria-label={
                user.username
                  ? "View profile for " + user.displayName
                  : "Set up your profile"
              }
              className="flex min-w-0 items-center gap-3 rounded-md px-3 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {mobileIdentity}
            </Link>
          )}
          <div className="flex min-w-0 items-stretch rounded-md border border-border">
            <nav aria-label="Account" className="min-w-0 w-1/2">
              <Link
                href="/settings"
                onClick={close}
                aria-current={pathname === "/settings" ? "page" : undefined}
                className={cn(
                  linkClass,
                  "h-full w-full min-w-0 gap-2",
                  pathname === "/settings" && "bg-muted text-foreground",
                )}
              >
                <Settings
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground",
                    pathname === "/settings" && "text-foreground",
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">Settings</span>
              </Link>
            </nav>
            <div
              role="group"
              aria-label="Theme"
              className="flex w-1/2 min-w-0 items-center border-l border-border"
            >
              {(
                [
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant="ghost"
                  size="icon"
                  aria-label={label}
                  aria-pressed={theme === value}
                  className={cn(
                    "h-12 min-w-0 flex-1",
                    theme === value && "bg-accent",
                  )}
                  onClick={() => setTheme(value)}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
      {isAuthenticated && !workspaceMode && (
        <nav aria-label="Create">
          <NavigationTooltip collapsed={collapsed} label="New Post">
            <Button
              asChild
              className={cn(
                "min-h-11 w-full justify-start gap-3 px-3",
                collapsed && "justify-center px-0",
              )}
            >
              <Link
                href="/create"
                onClick={close}
                aria-current={pathname === "/create" ? "page" : undefined}
              >
                <PenLine
                  className={cn(workspaceMode && "size-5")}
                  data-icon={collapsed ? undefined : "inline-start"}
                  aria-hidden="true"
                />
                <span className={cn(collapsed && "sr-only")}>New Post</span>
              </Link>
            </Button>
          </NavigationTooltip>
        </nav>
      )}
      {isAuthenticated && (
        <nav aria-label="Workspace">
          {navLink({
            href: "/dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
          })}
        </nav>
      )}
      {workspaceMode && isAuthenticated && (
        <div
          className={cn(
            "mx-auto -my-2.5 h-px w-[26.5px] bg-border",
            !collapsed && "ml-[5.25px]",
            mobileDrawer && "mx-0 w-full",
          )}
          aria-hidden="true"
        />
      )}
      {isAuthenticated && (
        <nav
          aria-label="Writing"
          className={cn(
            "flex flex-col gap-1",
            workspaceMode && "relative gap-0.5",
          )}
        >
          {!workspaceMode && <p className={sectionClass}>Writing</p>}
          {workspaceMode && (
            <NavigationTooltip collapsed={collapsed} label="New Post">
              <Link
                className={cn(
                  linkClass,
                  "text-primary hover:text-primary",
                  pathname === "/create" && "bg-muted text-primary",
                )}
                href="/create"
                onClick={close}
                aria-current={pathname === "/create" ? "page" : undefined}
              >
                <PenLine
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className={cn(collapsed && "sr-only")}>New Post</span>
              </Link>
            </NavigationTooltip>
          )}
          {writingLinks.map(navLink)}
        </nav>
      )}
      {workspaceMode && isAuthenticated && (
        <div
          className={cn(
            "mx-auto -my-2.5 h-px w-[26.5px] bg-border",
            !collapsed && "ml-[5.25px]",
            mobileDrawer && "mx-0 w-full",
          )}
          aria-hidden="true"
        />
      )}
      <nav
        aria-label="Reading"
        className={cn(
          "flex flex-col gap-1",
          workspaceMode && "relative gap-0.5",
        )}
      >
        {!workspaceMode && <p className={sectionClass}>Reading</p>}
        {!isAuthenticated && navLink({ href: "/", label: "Home", icon: Home })}
        {(isAuthenticated
          ? readingLinks
          : readingLinks.filter(({ href }) => href === "/blog")
        ).map(navLink)}
      </nav>
      {workspaceMode && isAuthenticated && showNotifications && (
        <div
          className={cn(
            "mx-auto -my-2.5 h-px w-[26.5px] bg-border",
            !collapsed && "ml-[5.25px]",
          )}
          aria-hidden="true"
        />
      )}
      {isAuthenticated && showNotifications && (
        <nav aria-label="Notifications">
          <NavigationTooltip
            collapsed={collapsed}
            label={
              (unread ?? 0) > 0
                ? `Notifications • ${unread} unread`
                : "Notifications"
            }
          >
            <Link
              className={cn(
                linkClass,
                pathname === "/dashboard/notifications" &&
                  "bg-muted text-foreground",
              )}
              href="/dashboard/notifications"
              onClick={close}
              aria-current={
                pathname === "/dashboard/notifications" ? "page" : undefined
              }
              aria-label={
                (unread ?? 0) > 0
                  ? `Notifications ${unread} unread`
                  : "Notifications"
              }
            >
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center",
                  workspaceMode && "size-5",
                )}
              >
                <Bell
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground",
                    workspaceMode &&
                      pathname === "/dashboard/notifications" &&
                      "text-foreground",
                  )}
                  aria-hidden="true"
                />
              </span>
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
        </nav>
      )}
      {workspaceMode && mobileDrawer && isAuthenticated && (
        <>
          <div className="-my-2.5 h-px w-full bg-border" aria-hidden="true" />
          <Button
            variant="ghost"
            className="min-h-12 w-full justify-start gap-3 px-[8.5px] text-base text-destructive hover:text-destructive"
            onClick={(event) => {
              const returnFocus =
                returnFocusRef?.current ?? event.currentTarget;
              close();
              if (exit)
                exit.requestSignOut(() => signOutUser(router), returnFocus);
              else void signOutUser(router);
            }}
          >
            <LogOut className="size-5" aria-hidden="true" />
            <span>Sign Out</span>
          </Button>
        </>
      )}
      {!workspaceMode && (
        <>
          <Separator />
          <nav aria-label="Account" className="flex flex-col gap-1">
            <p className={sectionClass}>Account</p>
            {isAuthenticated ? (
              <>
                {user?.username &&
                  navLink({
                    href: buildProfilePath(user.username),
                    label: "Profile",
                    icon: User,
                  })}
                {navLink({
                  href: "/settings",
                  label: "Settings",
                  icon: Settings,
                })}
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
                        exit.requestSignOut(
                          () => signOutUser(router),
                          returnFocus,
                        );
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
                <Link
                  className={linkClass}
                  href="/auth/sign-up"
                  onClick={close}
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
          <Separator />
          <div role="group" aria-label="Theme" className="flex flex-col gap-3">
            <p className={sectionClass}>Theme</p>
            <div
              className={cn(
                "grid grid-cols-3 gap-2",
                collapsed && "grid-cols-1",
              )}
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
        </>
      )}
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
