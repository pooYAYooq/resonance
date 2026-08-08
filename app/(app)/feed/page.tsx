import type { Metadata } from "next";
import { FeedContent } from "./_components/FeedContent";

export const metadata: Metadata = {
  title: "Feed",
  robots: { index: false, follow: false },
};

export default function FeedRoute() {
  return (
    <div className="py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Feed</h1>
        <p className="mt-2 text-muted-foreground">
          The latest posts from authors you follow.
        </p>
      </header>
      <FeedContent />
    </div>
  );
}
