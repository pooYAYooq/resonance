/**
 * Recent posts showcase section for the Resonance landing page.
 *
 * Renders as an async React Server Component. Fetches the 4 most recent
 * posts from Convex and displays them in an asymmetric grid layout. Each
 * card links to the full post view.
 */

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { MessageSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export async function RecentPostsSection() {
  const postsResult = await fetchQuery(api.posts.getPosts, {
    paginationOpts: { numItems: 4, cursor: null },
  });

  const posts = postsResult.page;

  return (
    <section className="py-16 md:py-24 bg-muted/5 border-y border-border">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 fill-mode-both text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Fresh from the community
            </h2>
            <p className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both text-lg text-muted-foreground max-w-[50ch]">
              Discover the latest ideas, stories, and conversations from writers around the world.
            </p>
          </div>
          <Link
            href="/blog"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "hidden sm:inline-flex animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both",
            )}
          >
            View All Posts
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post, index) => (
            <Card
              key={post._id}
              className={`pt-0 gap-4 flex flex-col h-full animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ${index === 0 ? "delay-0" : index === 1 ? "delay-150" : index === 2 ? "delay-300" : "delay-500"} fill-mode-both transition-all hover:shadow-lg hover:border-primary/20`}
            >
              <div className="relative h-56 w-full overflow-hidden">
                <Image
                  src={
                    post.imageUrl ??
                    "https://w.wallhaven.cc/full/k7/wallhaven-k7k9j7.jpg"
                  }
                  alt={post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>

              <CardContent className="flex-1">
                <Link href={`/blog/${post._id}`}>
                  <h3 className="text-xl font-semibold hover:text-primary transition-colors mb-3">
                    {post.title}
                  </h3>
                </Link>
                <p className="text-muted-foreground line-clamp-3">
                  {post.body}
                </p>
              </CardContent>

              <CardFooter className="mt-auto flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  {post.commentCount}{" "}
                  {post.commentCount === 1 ? "comment" : "comments"}
                </span>
                <Link
                  className={cn(
                    buttonVariants({
                      variant: "outline",
                    }),
                    "px-3 py-0 hover:text-primary hover:no-underline space-x-2",
                  )}
                  href={`/blog/${post._id}`}
                >
                  Read More
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/blog"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            View All Posts
          </Link>
        </div>
      </div>
    </section>
  );
}
