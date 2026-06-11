/**
 * Client component that renders an "Edit Profile" button only when the
 * current authenticated user owns the profile being viewed. Comparing
 * the auth userId to the route param happens in the browser because
 * `useQuery` cannot run on the server (the provider is gated on auth).
 */

"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface EditProfileButtonProps {
  /** Better Auth user ID of the profile being viewed. */
  profileUserId: string;
}

export function EditProfileButton({ profileUserId }: EditProfileButtonProps) {
  const currentUser = useQuery(api.users.getCurrentUser);

  // While the query is loading or no user is signed in, don't show the button.
  if (!currentUser) return null;
  if (currentUser.userId !== profileUserId) return null;

  return (
    <Link
      href="/settings"
      className={buttonVariants({ variant: "outline", className: "space-x-2" })}
    >
      <Settings className="size-4" />
      <span>Edit Profile</span>
    </Link>
  );
}
