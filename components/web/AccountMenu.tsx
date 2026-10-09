"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Bookmark, Heart, LogOut, Settings, User } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./UserAvatar";
import { signOutUser } from "./account-actions";
import { useOptionalAuthoringExit } from "./AuthoringExitProvider";

type AccountMenuProps = {
  presentation: "navbar" | "workspace";
  onNavigateAction?: () => void;
};

export function AccountMenu({
  presentation,
  onNavigateAction,
}: AccountMenuProps) {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const router = useRouter();
  const exit = useOptionalAuthoringExit();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pointerDismissRef = useRef(false);

  if (!currentUser) return null;

  const triggerLabel =
    presentation === "workspace"
      ? "Open workspace account menu"
      : "Open user menu";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={triggerRef}
        aria-label={triggerLabel}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserAvatar
          userId={currentUser.userId}
          name={currentUser.displayName}
          avatarUrl={currentUser.avatarUrl}
          className="size-8"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56"
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
        <DropdownMenuItem asChild>
          <Link href={`/u/${currentUser.userId}`} onClick={onNavigateAction}>
            <User />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/saved" onClick={onNavigateAction}>
            <Bookmark />
            <span>Saved</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/liked" onClick={onNavigateAction}>
            <Heart />
            <span>Liked</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" onClick={onNavigateAction}>
            <Settings />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
