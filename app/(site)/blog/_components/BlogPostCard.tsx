import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CoverImage } from "@/components/web/CoverImage";
import { PostAuthorLine } from "@/components/web/PostAuthorLine";
import { PostCardCover } from "@/components/web/PostCardCover";
import { PostEngagement } from "@/components/web/PostEngagement";
import { PostTags } from "@/components/web/PostTags";
import { cn } from "@/lib/utils";

export type DiscoverPost = FunctionReturnType<
  typeof api.discover.getDiscoverPosts
>["page"][number];

type BlogPostCardProps = {
  post: DiscoverPost;
  priority?: boolean;
};

function titleClasses(title: string) {
  return title.trim().length > 50 ? "text-base" : "text-lg";
}

export function BlogPostCard({ post, priority = false }: BlogPostCardProps) {
  const postHref = `/blog/${post._id}`;

  return (
    <Card className="h-full gap-0 overflow-hidden rounded-sm p-0 transition-colors motion-safe:transition-all motion-safe:hover:-translate-y-0.5 hover:bg-muted/30 md:grid md:grid-cols-[2fr_3fr]">
      <PostCardCover
        testId="blog-card-cover"
        ratio="16/9"
        className="rounded-t-sm md:aspect-auto md:rounded-l-sm md:rounded-tr-none"
      >
        <CoverImage
          src={post.imageUrl}
          alt={post.title}
          sizes="(min-width: 768px) 40vw, 100vw"
          priority={priority}
          className="object-cover"
        />
      </PostCardCover>
      <div className="flex flex-col gap-3 p-4">
        <Link href={postHref}>
          <h3
            className={cn(
              "line-clamp-2 break-words font-semibold tracking-[-0.02em] hover:text-primary",
              titleClasses(post.title),
            )}
          >
            {post.title}
          </h3>
        </Link>
        <PostAuthorLine
          authorId={post.authorId}
          authorName={post.authorName}
          authorUsername={post.authorUsername}
          authorAvatarUrl={post.authorAvatarUrl}
          date={post.publishedAt}
          dateMode="absolute"
        />
        <PostTags tags={post.tags} filterCanonical />
        <div className="mt-auto flex items-center justify-between gap-3">
          <PostEngagement
            postId={post._id}
            postTitle={post.title}
            commentCount={post.commentCount}
            likeCount={post.likeCount}
            isLiked={false}
            isBookmarked={false}
            showLikeButton={false}
            savePresentation="icon"
          />
          <Link
            href={postHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
            )}
          >
            Read
          </Link>
        </div>
      </div>
    </Card>
  );
}
