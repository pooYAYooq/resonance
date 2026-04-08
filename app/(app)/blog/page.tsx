import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A page component that renders a list of blog posts.
 *
 * This page is wrapped in a suspense boundary, and will render a skeleton loading UI until the blog posts have been fetched.
 * The blog posts are fetched from the Convex API using the `api.posts.getPosts` query.
 */
export default function BlogPost() {
  // await new Promise((resolve) => setTimeout(resolve, 4000));
  return (
    <div className="container mx-auto">
      <div className="text-center pb-12 pt-24">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Our Blog
        </h1>
        <p className="pt-4 max-w-2xl text-muted-foreground mx-auto text-xl">
          Insight, thoughts, and stories from our universal team.
        </p>
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
  const posts = await fetchQuery(api.posts.getPosts);
  return (
    <div className="grid px-6 py-6 items-stretch border-l-2 border-r-2 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts?.map((post) => (
        <Card key={post._id} className="pt-0 gap-4 flex flex-col h-full">
          <div className=" relative h-48 w-full overflow-hidden mb-8">
            <Image
              src="https://w.wallhaven.cc/full/k7/wallhaven-k7k9j7.jpg"
              alt="Blog Post Image"
              fill
              className="object-cover"
            />
          </div>

          <CardContent className="mb-0 flex-1">
            <Link href={`/blog/${post._id}`}>
              <h1 className="text-xl mb-4 font-semibold hover:text-primary">
                {post.title}
              </h1>
            </Link>
            <p className="text-muted-foreground line-clamp-3">{post.body}</p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Link
              className={cn(
                buttonVariants({
                  variant: "outline",
                  className: " w-full",
                }),
                "px-0 py-0 hover:text-primary hover:no-underline space-x-2",
              )}
              href={`/blog/${post._id}`}
            >
              Read More
            </Link>
          </CardFooter>
        </Card>
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
