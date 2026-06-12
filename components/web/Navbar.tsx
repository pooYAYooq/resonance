/**
 * Sticky site navigation bar.
 *
 * Client Component ("use client") because it uses `useConvexAuth`,
 * `useRouter`, and auth callbacks. The navbar is `sticky top-0` so it
 * remains visible while scrolling. A `bg-background` is required to
 * prevent page content from showing through. Content is constrained to
 * `max-w-7xl` to align with the page footer grid.
 *
 * When authenticated, the user's avatar triggers a Radix-based dropdown
 * with profile, settings, and logout items. The unauthenticated state
 * shows Sign up + Login links as before.
 */
"use client";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { UserAvatar } from "./UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { LogOut, User as UserIcon, Settings as SettingsIcon } from "lucide-react";

export function Navbar() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
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
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 flex items-center justify-between py-5">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/">
            <h1 className="text-3xl font-extrabold">RESONANCE</h1>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            <Link className={buttonVariants({ variant: "ghost" })} href="/">
              Home
            </Link>
            <Link className={buttonVariants({ variant: "ghost" })} href="/blog">
              Blog
            </Link>
            {isAuthenticated && (
              <Link className={buttonVariants({ variant: "ghost" })} href="/create">
                Create
              </Link>
            )}
          </div>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-2">
          {isLoading ? null : isAuthenticated ? (
            currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Open user menu"
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <UserAvatar
                    userId={currentUser.userId}
                    name={currentUser.displayName}
                    avatarUrl={currentUser.avatarUrl}
                    className="size-8"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuLabel className="flex flex-col gap-1 p-0 font-normal">
                    <div className="flex items-center gap-3 px-2 py-2">
                      <UserAvatar
                        userId={currentUser.userId}
                        name={currentUser.displayName}
                        avatarUrl={currentUser.avatarUrl}
                        className="size-8"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {currentUser.displayName}
                        </span>
                        {currentUser.email && (
                          <span className="text-xs text-muted-foreground truncate">
                            {currentUser.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/u/${currentUser.userId}`}>
                      <UserIcon />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <SettingsIcon />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
                    <LogOut />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null
          ) : (
            <>
              <Link
                className={buttonVariants({ variant: "default" })}
                href="/auth/sign-up"
              >
                Sign up
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href="/auth/login"
              >
                Login
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
