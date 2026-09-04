import Image from "next/image";
import Link from "next/link";
import { MessageSquare, Heart } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { isCanonicalPostTag } from "@/lib/constants/post-tags";
import { buildDiscoverTopicLink } from "@/lib/discover";

export type DiscoverPost = FunctionReturnType<
  typeof api.discover.getDiscoverPosts
>["page"][number];

interface DiscoverPostSummaryProps {
  post: DiscoverPost;
}

// Summaries render only the discover projection, so BlockNote JSON never reaches the reader UI.
export function DiscoverPostSummary({ post }: DiscoverPostSummaryProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video w-full bg-muted">
        <Image
          src={
            post.imageUrl ??
            "https://w.wallhaven.cc/full/k7/wallhaven-k7k9j7.jpg"
          }
          alt={post.title}
          fill
          sizes="(max-width: 768px) 100vw, 66vw"
          className="object-cover"
        />
      </div>
      <CardHeader data-testid="discover-card-header">
        <CardTitle className="text-2xl tracking-tight">
          <h2>
            <Link href={`/blog/${post._id}`} className="hover:text-primary">
              {post.title}
            </Link>
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent
        data-testid="discover-card-content"
        className="flex flex-col gap-3"
      >
        <p className="line-clamp-3 text-muted-foreground">{post.bodyText}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Link
            href={`/u/${post.authorId}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {post.authorName}
          </Link>
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(post.publishedAt).toISOString()}>
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
              year: "numeric",
            })}
          </time>
        </div>
        <div className="flex flex-wrap gap-2">
          {post.tags.filter(isCanonicalPostTag).map((tag) => (
            <Link
              key={tag}
              href={buildDiscoverTopicLink(tag)}
              className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              {tag}
            </Link>
          ))}
        </div>
      </CardContent>
      <CardFooter
        className="flex items-center gap-4 text-xs text-muted-foreground"
        aria-label="Engagement"
      >
        <span className="flex items-center gap-1">
          <MessageSquare className="size-3.5" />
          {post.commentCount}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="size-3.5" />
          {post.likeCount}
        </span>
      </CardFooter>
    </Card>
  );
}
