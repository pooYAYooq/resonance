"use client";
import Link from "next/link";
import { Button, buttonVariants } from "../ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useConvexAuth } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  return (
    <nav className="flex items-center justify-between w-full py-5">
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
          <Link className={buttonVariants({ variant: "ghost" })} href="/create">
            Create
          </Link>
        </div>
      </div>

      {/* Auth Buttons */}
      <div className="flex items-center gap-2">
        {isLoading ? null : isAuthenticated ? (
          <Button
            onClick={() =>
              authClient.signOut({
                fetchOptions: {
                  /**
                   * Called when the sign out request is successful.
                   * Shows a success toast with the message "Logged out successfully!".
                   */
                  onSuccess: () => {
                    toast.success("Logged out successfully!");

                    // Redirect to the home page after successful logout
                    router.push("/");
                  },
                  /**
                   * Called when the sign out request is rejected.
                   * Shows an error toast with the error message from the betterauth error.
                   */
                  onError: (error) => {
                    toast.error(error.error.message);
                  },
                },
              })
            }
          >
            Logout
          </Button>
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
    </nav>
  );
}
