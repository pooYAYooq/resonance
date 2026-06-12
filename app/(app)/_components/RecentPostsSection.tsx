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
import { SectionHeading } from "@/components/web/SectionHeading";
import Link from "next/link";

export async function RecentPostsSection() {
  const postsResult = await fetchQuery(api.posts.getPosts, {
    paginationOpts: { numItems: 4, cursor: null },
  });

  const posts = postsResult.page;

  return (
    <section className="py-16 md:py-24 bg-muted/5 border-y border-border">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <SectionHeading
          title="Fresh from the community"
          action={
            <Link
              href="/blog"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "hidden sm:inline-flex",
              )}
            >
              View All Posts
            </Link>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              postId={post._id}
              title={post.title}
              body={post.body}
              imageUrl={post.imageUrl}
              commentCount={post.commentCount}
              likeCount={post.likeCount ?? 0}
              isLiked={post.isLiked ?? false}
              createdAt={post.createdAt}
              authorId={post.authorId}
              authorName={post.authorName}
              authorAvatarUrl={post.authorAvatarUrl}
            />
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
