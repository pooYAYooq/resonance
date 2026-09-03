"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { LogOut, Settings, User } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/web/NotificationBell";
import { UserAvatar } from "@/components/web/UserAvatar";
import { toast } from "sonner";

export function WorkspaceUtilities({ onNavigate }: { onNavigate?: () => void }) {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const router = useRouter();

  function handleSignOut() {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Logged out successfully!");
          router.push("/");
        },
        onError: (error) => {
          toast.error(error.error.message);
        },
      },
    });
  }

  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      {currentUser && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open workspace account menu"
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <UserAvatar
              userId={currentUser.userId}
              name={currentUser.displayName}
              avatarUrl={currentUser.avatarUrl}
              className="size-8"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/u/${currentUser.userId}`} onClick={onNavigate}>
                <User />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" onClick={onNavigate}>
                <Settings />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                onNavigate?.();
                handleSignOut();
              }}
            >
              <LogOut />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
