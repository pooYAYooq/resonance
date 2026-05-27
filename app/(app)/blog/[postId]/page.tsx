/**
 * Renders a single blog post by its Convex document ID.
 * Fetches the post server-side and handles the "not found" case inline.
 * Images are resolved server-side; posts without a custom image fall back
 * to a default cover image.
 */

import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Separator } from "@/components/ui/separator";
import { CommentSection } from "@/components/web/CommentSection";

/** Props received by the dynamic blog post route. */
interface PostIdRouteProps {
  params: Promise<{ postId: Id<"posts"> }>;
}

/**
 * Server component that displays a single blog post.
 *
 * @param params - Next.js dynamic route params, resolved as a Promise containing the Convex `postId`.
 * @returns JSX.Element: the rendered post page, or a "not found" fallback when the post is missing.
 */
export default async function PostIdRoute({ params }: PostIdRouteProps) {
  const { postId } = await params;
  const [post, preloadedComments] = await Promise.all([
    fetchQuery(api.posts.getPostById, { postId: postId }),
    preloadQuery(api.comments.getCommentsByPostId, { postId }),
  ]);

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-4">Post not found</h1>
        <Link href="/blog" className={buttonVariants({ variant: "ghost" })}>
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-in fade-in duration-500 relative">
      <Link
        className={buttonVariants({
          variant: "outline",
          className: "space-x-2",
        })}
        href="/blog"
      >
        <ArrowLeft className="size-4" />
        Back to blog page
      </Link>
      <div className="relative w-full h-100 mt-8 rounded-xl overflow-hidden shadow-sm">
        <Image
          src={
            post.imageUrl ??
            "https://w.wallhaven.cc/full/k7/wallhaven-k7k9j7.jpg"
          }
          alt={post.title}
          fill
          className="object-cover hover:scale-102 transition-transform duration-800 ease-in-out"
          priority
        />
      </div>
      <div>
        <h1 className="text-4xl font-bold mt-8 tracking-tight text-foreground">
          {post.title}
        </h1>
        <p className="text-muted-foreground mt-4 text-sm">
          Published on:{" "}
          {new Date(post._creationTime).toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
      <Separator className="my-8" orientation="horizontal" decorative={true} />
      <div className="mt-6 prose max-w-none">
        <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {post.body}
        </p>
      </div>
      <Separator className="my-8" orientation="horizontal" decorative={true} />
      <CommentSection
        preloadedComments={preloadedComments}
        initialTotalCount={post.commentCount ?? 0}
      />
    </div>
  );
}
