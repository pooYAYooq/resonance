/**
 * Renders a single blog post by its Convex document ID.
 * Fetches the post server-side and handles the "not found" case inline.
 * Images are resolved server-side; posts without a custom image render the
 * blank transparent fallback, which loads no image.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Separator } from "@/components/ui/separator";
import { CommentSection } from "@/components/web/CommentSection";
import { LikeButton } from "@/components/web/LikeButton";
import { BookmarkButton } from "@/components/web/BookmarkButton";
import { truncateForDescription } from "@/lib/constants/seo";
import { TagPill } from "@/components/web/TagPill";
import { PostBody } from "@/components/web/PostBody";
import { PostViewTracker } from "@/components/web/PostViewTracker";
import { PostCover } from "@/components/web/PostCover";
import { extractPlainText, parsePostBody } from "@/lib/post-content";

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

  if (!post || post.publishedAt === undefined) {
    return {
      title: "Post Not Found",
    };
  }

  const parsed = parsePostBody(post.body);
  const description = truncateForDescription(
    parsed.kind === "structured"
      ? extractPlainText(parsed.document.blocks)
      : "",
  );
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
  const post = await fetchAuthQuery(api.posts.getPostById, { postId });

  if (!post || post.publishedAt === undefined) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-4">Post not found</h1>
        <Link href="/blog" className={buttonVariants({ variant: "ghost" })}>
          Back to blog
        </Link>
      </div>
    );
  }

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    });

  return (
    <div
      data-testid="reader-frame"
      className="relative w-full pt-6 pb-8 animate-in fade-in duration-500"
    >
      <PostViewTracker postId={postId} />
      <PostCover
        src={post.imageUrl}
        alt={post.title}
        priority
        className="rounded-xl shadow-sm"
        imageClassName="hover:scale-102 transition-transform duration-800 ease-in-out"
      />
      <div>
        <h1 className="text-h1 font-bold mt-6 tracking-tight text-foreground font-serif">
          {post.title}
        </h1>
        <p className="text-muted-foreground mt-4 text-sm">
          {`Published on: ${formatDate(post.publishedAt)}`}
        </p>
        {post.updatedAt > post.publishedAt && (
          <p className="text-muted-foreground mt-2 text-sm">
            {`Updated on: ${formatDate(post.updatedAt)}`}
          </p>
        )}
        {(post.tags ?? []).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(post.tags ?? []).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>
      <div data-testid="reader-prose" className="mx-auto w-full max-w-[700px]">
        <Separator className="my-8" orientation="horizontal" decorative={true} />
        <div className="mt-6 max-w-none">
          <PostBody body={post.body} inlineImages={post.inlineImages} />
        </div>
        <Separator className="my-8" orientation="horizontal" decorative={true} />
        <div className="flex items-center gap-2 mb-4">
          <LikeButton
            postId={postId}
            isLiked={post.isLiked ?? false}
            likeCount={post.likeCount ?? 0}
          />
          <BookmarkButton postId={postId} isBookmarked={post.isBookmarked} />
        </div>
        <Link
          href="/blog"
          className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to all posts
        </Link>
        <Suspense fallback={null}>
          <CommentSection initialTotalCount={post.commentCount ?? 0} />
        </Suspense>
      </div>
    </div>
  );
}
