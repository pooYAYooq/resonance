"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CommentDestinationError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <section
      data-comment-destination-error=""
      className="mx-auto max-w-175 space-y-4 py-6"
    >
      <h1 className="text-2xl font-semibold">
        Unable to load this conversation
      </h1>
      <p className="text-muted-foreground">Please try again.</p>
      <div className="flex items-center gap-4">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/dashboard/notifications"
          className="underline underline-offset-4"
        >
          Notifications
        </Link>
      </div>
    </section>
  );
}
