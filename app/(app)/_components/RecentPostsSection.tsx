/**
 * Recent posts showcase section for the Resonance landing page.
 *
 * Renders as an async React Server Component. Fetches the 4 most recent
 * posts from Convex and displays them in an asymmetric grid layout. Each
 * card links to the full post view.
 */

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PostCard } from "@/components/web/PostCard";
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
            <div
              key={post._id}
              className={`animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ${index === 0 ? "delay-0" : index === 1 ? "delay-150" : index === 2 ? "delay-300" : "delay-500"} fill-mode-both transition-all hover:shadow-lg hover:border-primary/20 rounded-xl`}
            >
              <PostCard
                postId={post._id}
                title={post.title}
                body={post.body}
                imageUrl={post.imageUrl}
                commentCount={post.commentCount}
                createdAt={post.createdAt}
                authorId={post.authorId}
                authorName={post.authorName}
                authorAvatarUrl={post.authorAvatarUrl}
              />
            </div>
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
