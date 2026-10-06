/**
 * Renders a single blog post by its Convex document ID.
 * Fetches the post server-side and handles the "not found" case inline.
 * Images are resolved server-side; posts without a custom image render the
 * blank transparent fallback, which loads no image.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
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
import { PostBody } from "@/components/web/PostBody";
import { PostViewTracker } from "@/components/web/PostViewTracker";
import { PostCover } from "@/components/web/PostCover";
import { FollowButton } from "@/components/web/FollowButton";
import { PostArticleHeader } from "@/components/web/PostArticleHeader";
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
      <div data-testid="not-found-frame" className="relative w-full pt-6 pb-8">
        <h1 className="text-h1 font-bold tracking-tight text-foreground font-serif">
          Post not found
        </h1>
        <Link
          href="/blog"
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to all posts
        </Link>
      </div>
    );
  }

  const displayName = post.authorName?.trim() || "Unknown";

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
      <PostArticleHeader
        title={post.title}
        author={{
          userId: post.authorId,
          name: displayName,
          avatarUrl: post.authorAvatarUrl,
        }}
        tags={post.tags ?? []}
        published={{ publishedAt: post.publishedAt, updatedAt: post.updatedAt }}
        interactive
        authorAction={
          post.authorExists && !post.isAuthor ? (
            <FollowButton
              profileUserId={post.authorId}
              authorName={displayName}
              isFollowing={post.isFollowing}
              size="sm"
            />
          ) : undefined
        }
      />
      <Separator className="my-8" orientation="horizontal" decorative={true} />
      <div
        data-testid="reader-prose"
        className="mx-auto w-full max-w-175 xl:mx-0"
      >
        <div className="mt-6 max-w-none">
          <PostBody body={post.body} inlineImages={post.inlineImages} />
        </div>
        <Separator
          className="my-8"
          orientation="horizontal"
          decorative={true}
        />
        <div
          aria-label="Post engagement"
          role="group"
          className="flex flex-wrap items-center gap-2 mb-6"
        >
          <LikeButton
            postId={postId}
            isLiked={post.isLiked ?? false}
            likeCount={post.likeCount ?? 0}
            presentation="reader"
          />
          <BookmarkButton
            postId={postId}
            isBookmarked={post.isBookmarked}
            presentation="reader"
          />
        </div>
        <Suspense fallback={null}>
          <CommentSection initialTotalCount={post.commentCount ?? 0} />
        </Suspense>
        <Link
          href="/blog"
          className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to all posts
        </Link>
      </div>
    </div>
  );
}
