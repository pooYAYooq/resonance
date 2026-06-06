/**
 * Renders a single blog post by its Convex document ID.
 * Fetches the post server-side and handles the "not found" case inline.
 * Images are resolved server-side; posts without a custom image fall back
 * to a default cover image.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Separator } from "@/components/ui/separator";
import { CommentSection } from "@/components/web/CommentSection";
import { truncateForDescription } from "@/lib/constants/seo";

/** Props received by the dynamic blog post route. */
interface PostIdRouteProps {
  params: Promise<{ postId: Id<"posts"> }>;
}

/**
 * Generates metadata for a single blog post page.
 *
 * Fetches the post by its Convex ID and returns dynamic title,
 * description, and Open Graph tags derived from the post content.
 */
export async function generateMetadata({
  params,
}: PostIdRouteProps): Promise<Metadata> {
  const { postId } = await params;
  const post = await fetchQuery(api.posts.getPostById, { postId });

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const description = truncateForDescription(post.body);
  const images = post.imageUrl ? [post.imageUrl] : undefined;

  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images,
    },
  };
}

/**
 * Server component that displays a single blog post.
 *
 * @param params - Next.js dynamic route params, resolved as a Promise containing the Convex `postId`.
 * @returns JSX.Element: the rendered post page, or a "not found" fallback when the post is missing.
 */
export default async function PostIdRoute({ params }: PostIdRouteProps) {
  const { postId } = await params;
  const post = await fetchQuery(api.posts.getPostById, { postId: postId });

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
      <Suspense fallback={null}>
        <CommentSection initialTotalCount={post.commentCount ?? 0} />
      </Suspense>
    </div>
  );
}
