"use client";

import { Button } from "@/components/ui/button";

interface BlogErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BlogError({ reset }: BlogErrorProps) {
  return (
    <main className="container mx-auto flex min-h-[50vh] items-center justify-center px-6 py-24">
      <div
        role="alert"
        className="flex max-w-md flex-col items-center gap-4 border p-8 text-center"
      >
        <h1 className="text-2xl font-semibold">Could not load the blog</h1>
        <p className="text-muted-foreground">
          Something went wrong while loading Discover. Please try again.
        </p>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
