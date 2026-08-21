"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export function MobileNavMenu({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open navigation menu"
        className="rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Menu className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuItem asChild>
          <Link href="/">Home</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/blog">Blog</Link>
        </DropdownMenuItem>
        {isAuthenticated ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/dashboard">Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/create">New Post</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/feed">Feed</Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
