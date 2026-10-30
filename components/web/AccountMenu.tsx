"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import {
  Bookmark,
  ChevronDown,
  Heart,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./UserAvatar";
import { signOutUser } from "./account-actions";
import { useOptionalAuthoringExit } from "./AuthoringExitProvider";
import { buildProfilePath } from "@/lib/username";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AccountMenuProps = {
  presentation: "navbar" | "workspace";
  onNavigateAction?: () => void;
  collapsed?: boolean;
};

export function AccountMenu({
  presentation,
  onNavigateAction,
  collapsed = false,
}: AccountMenuProps) {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const router = useRouter();
  const exit = useOptionalAuthoringExit();
  const { theme, setTheme } = useTheme();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pointerDismissRef = useRef(false);

  if (!currentUser) return null;

  const triggerLabel =
    presentation === "workspace"
      ? "Open workspace account menu"
      : "Open user menu";

  const trigger = (
    <DropdownMenuTrigger
      ref={triggerRef}
      aria-label={triggerLabel}
      className={cn(
        "rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        presentation === "workspace" &&
          "group/account-trigger flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-muted",
        presentation === "workspace" && !collapsed && "pl-[2.5px]",
        presentation === "workspace" && collapsed && "justify-center px-0",
      )}
    >
      <UserAvatar
        userId={currentUser.userId}
        name={currentUser.displayName}
        avatarUrl={currentUser.avatarUrl}
        className={cn("size-8", presentation === "workspace" && "shrink-0")}
      />
      {presentation === "workspace" && !collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {currentUser.displayName}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/account-trigger:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </>
      )}
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu modal={presentation !== "workspace"}>
      {presentation === "workspace" && collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Account
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent
        align={presentation === "workspace" ? "center" : "end"}
        side={presentation === "workspace" ? "top" : "bottom"}
        sideOffset={presentation === "workspace" ? 20 : 4}
        collisionPadding={presentation === "workspace" ? 12 : 0}
        className={cn(
          "min-w-56",
          presentation === "workspace"
            ? "w-[290px] max-w-[calc(100vw-24px)]"
            : "w-56",
        )}
        onPointerDownOutside={() => {
          pointerDismissRef.current = true;
        }}
        onCloseAutoFocus={(event) => {
          if (pointerDismissRef.current) {
            pointerDismissRef.current = false;
            event.preventDefault();
          }
        }}
      >
        <DropdownMenuLabel className="flex flex-col gap-1 p-0 font-normal">
          <div className="flex items-center gap-3 px-2 py-2">
            <UserAvatar
              userId={currentUser.userId}
              name={currentUser.displayName}
              avatarUrl={currentUser.avatarUrl}
              className="size-8"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {currentUser.displayName}
              </span>
              {currentUser.email && (
                <span className="truncate text-xs text-muted-foreground">
                  {currentUser.email}
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {currentUser.username && (
            <DropdownMenuItem asChild>
              <Link
                href={buildProfilePath(currentUser.username)}
                onClick={onNavigateAction}
              >
                <User />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
          )}
          {presentation !== "workspace" && (
            <DropdownMenuItem asChild>
              <Link href="/dashboard/saved" onClick={onNavigateAction}>
                <Bookmark />
                <span>Saved</span>
              </Link>
            </DropdownMenuItem>
          )}
          {presentation !== "workspace" && (
            <DropdownMenuItem asChild>
              <Link href="/dashboard/liked" onClick={onNavigateAction}>
                <Heart />
                <span>Liked</span>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/settings" onClick={onNavigateAction}>
              <Settings />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {presentation === "workspace" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={theme ?? "system"}
              onValueChange={setTheme}
              className="grid grid-cols-3 gap-1 px-1 pb-1"
            >
              {(
                [
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <DropdownMenuRadioItem
                      value={value}
                      aria-label={label}
                      onSelect={(event) => event.preventDefault()}
                      className="flex min-h-11 items-center justify-center rounded-md px-1 py-2 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground [&>span]:hidden"
                    >
                      <Icon aria-hidden="true" />
                    </DropdownMenuRadioItem>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    {label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              onNavigateAction?.();
              if (exit)
                exit.requestSignOut(
                  () => signOutUser(router),
                  triggerRef.current,
                );
              else void signOutUser(router);
            }}
          >
            <LogOut />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
