/**
 * Route-scoped 404 for `/u/[username]`.
 *
 * Shared by every unavailable path: unknown names, reserved names, and
 * deleted accounts whose claim outlived the profile. `page.tsx` calls
 * `notFound()` for all of them, so they render identically.
 */

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <BookOpen
        className="mx-auto size-12 text-muted-foreground mb-4"
        strokeWidth={1.5}
      />
      <h1 className="text-3xl font-extrabold tracking-tight mb-4">
        User not found
      </h1>
      <p className="text-muted-foreground mb-8">
        The profile you are looking for does not exist.
      </p>
      <Link href="/blog" className={buttonVariants({ variant: "outline" })}>
        Back to blog
      </Link>
    </div>
  );
}
