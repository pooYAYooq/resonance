/**
 * Blog listing page.
 * Fetches posts server-side and renders them in a responsive grid.
 * Wraps the async list in a Suspense boundary with a skeleton fallback.
 */

import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCTA } from "@/components/web/AuthCTA";
import { PostCard } from "@/components/web/PostCard";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "A collection of ideas, experiments, and conversations from people who see patterns in the noise.",
};

/**
 * A page component that renders a list of blog posts.
 *
 * This page is wrapped in a suspense boundary, and will render a skeleton loading UI until the blog posts have been fetched.
 * The blog posts are fetched from the Convex API using the `api.posts.getPosts` query.
 *
 * @returns JSX.Element: the blog listing page with a suspense boundary.
 */
export default function BlogPost() {
  return (
    <div className="container mx-auto">
      <div className="pt-24 pb-20 sm:pb-24">
        <div className="relative border border-primary/5 bg-linear-to-br from-muted/20 via-muted/10 to-primary/5 p-8 sm:p-12 lg:p-16 overflow-hidden">
          {/* Decorative ambient blobs */}
          <div className="absolute -top-100 -right-50 w-20 h-240 bg-primary/3 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/2 rounded-full blur-3xl" />

          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
              Resonance / Blog
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
              Stories that echo
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-[50ch] leading-relaxed">
              A collection of ideas, experiments, and conversations from people
              who see patterns in the noise.
            </p>
            <AuthCTA className="mt-8" />
          </div>
        </div>
      </div>
      <Suspense fallback={<SkeletonLoadingUi />}>
        <LoadBlogList />
      </Suspense>
    </div>
  );
}

/**
 * A function that loads a list of blog posts.
 *
 * The function fetches the blog posts from the Convex API using the `api.posts.getPosts` query.
 *
 * The function renders a grid of blog post cards, with each card containing the post title, body, and a link to read more.
 *
 * @returns A JSX element representing a grid of blog post cards.
 */
async function LoadBlogList() {
  const posts = await fetchQuery(api.posts.getPosts, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  return (
    <div className="grid px-6 py-6 items-stretch border-l border-r gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts?.page?.map((post) => (
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
  );
}

/**
 * A skeleton loading UI component.
 * It displays a grid of 3 loading cards with a title, image, and body.
 * Each card has a loading animation.
 * The component is designed to be used as a placeholder while data is being loaded.
 */
function SkeletonLoadingUi() {
  return (
    <div className="grid items-stretch px-6 py-6 border-l border-r gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="pt-0 gap-4 flex flex-col h-full">
          <div className="relative h-48 w-full overflow-hidden mb-8">
            <Skeleton className="object-cover h-full w-full rounded-t-lg" />
          </div>

          <div className="flex flex-col space-y-3">
            <Skeleton className="h-6 w-full rounded bg-orange-50/40" />
            <Skeleton className="h-4 w-full rounded bg-orange-50/40" />
            <Skeleton className="h-4 w-5/6 rounded bg-orange-50/40" />
            <Skeleton className="h-2 w-1/4 rounded mt-2 bg-orange-500/20" />
          </div>
        </div>
      ))}
    </div>
  );
}
