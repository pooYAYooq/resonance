/**
 * Sticky site navigation bar.
 *
 * Client Component ("use client") because it uses `useConvexAuth`,
 * `useRouter`, and auth callbacks. The navbar is `sticky top-0` so it
 * remains visible while scrolling. A `bg-background` is required to
 * prevent page content from showing through. Content is constrained to
 * `max-w-7xl` to align with the page footer grid.
 *
 * When authenticated, the user's avatar opens the shared account menu. The
 * unauthenticated state shows Sign up + Login links as before.
 */
"use client";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useConvexAuth } from "convex/react";
import { NotificationBell } from "./NotificationBell";
import { MobileNavMenu } from "./MobileNavMenu";
import { AccountMenu } from "./AccountMenu";

export function Navbar() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 flex items-center justify-between py-5">
        {/* Logo */}
        <div className="flex items-center gap-4 md:gap-8">
          <Link href={isAuthenticated ? "/dashboard" : "/"}>
            <h1 className="text-3xl font-extrabold">RESONANCE</h1>
          </Link>

          {/* Navigation Links */}
          <div className="hidden items-center gap-2 md:flex">
            {!isLoading &&
              (isAuthenticated ? (
                <>
                  <Link
                    className={buttonVariants({ variant: "ghost" })}
                    href="/blog"
                  >
                    Discover
                  </Link>
                  <Link
                    className={buttonVariants({ variant: "ghost" })}
                    href="/feed"
                  >
                    Feed
                  </Link>
                  <Link
                    className={buttonVariants({ variant: "default" })}
                    href="/create"
                  >
                    New Post
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    className={buttonVariants({ variant: "ghost" })}
                    href="/"
                  >
                    Home
                  </Link>
                  <Link
                    className={buttonVariants({ variant: "ghost" })}
                    href="/blog"
                  >
                    Discover
                  </Link>
                </>
              ))}
          </div>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-2">
          {!isLoading && <MobileNavMenu isAuthenticated={isAuthenticated} />}
          {isLoading ? null : isAuthenticated ? (
            <>
              <NotificationBell />
              <AccountMenu presentation="navbar" />
            </>
          ) : (
            <>
              <Link
                className={buttonVariants({ variant: "default" })}
                href="/auth/sign-up"
              >
                Sign Up
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href="/auth/login"
              >
                Log In
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
