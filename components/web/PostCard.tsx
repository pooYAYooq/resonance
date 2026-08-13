/**
 * Shared blog post card used by the blog listing, the landing page's
 * `RecentPostsSection`, and the public profile page. Renders a cover
 * image, an author row that links to the author's profile, the post
 * title, a body excerpt, the comment count, a live like button, and
 * a "Read More" link to the post detail page.
 *
 * This component is a Server Component. It does not subscribe to Convex
 * queries directly. It renders two client components: `LikeButton`
 * (mutation-only; like state comes from server-rendered props) and
 * `BookmarkButton` (self-subscribes to `bookmarks.isBookmarked` because
 * server-side `fetchQuery` runs unauthenticated in this repo). Parents
 * are responsible for fetching the post data via `fetchQuery` (or
 * `useQuery` for live updates) and passing the hydrated fields as props.
 */

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { UserAvatar } from "./UserAvatar";
import { LikeButton } from "./LikeButton";
import { BookmarkButton } from "./BookmarkButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";
import { TagPill } from "./TagPill";
import { extractPlainText, parsePostBody } from "@/lib/post-content";

const DEFAULT_COVER_IMAGE =
  "https://w.wallhaven.cc/full/k7/wallhaven-k7k9j7.jpg";

interface PostCardProps {
  /** Convex document ID of the post; used to build the detail page link. */
  postId: Id<"posts">;
  /** Post title rendered as a clickable heading. */
  title: string;
  /** Full post body. The card displays a `line-clamp-3` excerpt. */
  body: string;
  /** Server-resolved image URL. Falls back to a default cover image. */
  imageUrl?: string | null;
  /** Pre-computed comment count to display in the footer. */
  commentCount: number;
  /** Pre-computed like count to display in the footer. */
  likeCount: number;
  /** Whether the current user has liked this post. */
  isLiked: boolean;
  /** Unix timestamp (ms) of when the post was created. */
  createdAt: number;
  /** Better Auth user ID of the post's author. */
  authorId: string;
  /** Display name of the author. May be `null` if no `users` record exists. */
  authorName: string | null;
  /**
   * Optional OAuth-provided avatar URL. When `null` or `undefined`,
   * `UserAvatar` falls back to a DiceBear-generated image.
   */
  authorAvatarUrl?: string | null;
  /** Stored or normalized display tags. */
  tags?: string[];
}

/**
 * Renders a blog post card with author information, optional tags, engagement metrics, and a link to the full post.
 *
 * @param props - Post data and metadata used to populate the card.
 * @returns The rendered post card.
 */
export function PostCard({
  postId,
  title,
  body,
  imageUrl,
  commentCount,
  likeCount,
  isLiked,
  createdAt,
  authorId,
  authorName,
  authorAvatarUrl,
  tags,
}: PostCardProps) {
  const displayName = authorName?.trim() || "Unknown";
  const postHref = `/blog/${postId}`;
  const profileHref = `/u/${authorId}`;
  const parsedBody = parsePostBody(body);
  const excerpt =
    parsedBody.kind === "structured"
      ? extractPlainText(parsedBody.document.blocks)
      : parsedBody.kind === "legacy"
        ? parsedBody.text
        : "";

  return (
    <Card className="pt-0 gap-0 flex flex-col h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-video w-full overflow-hidden">
        <Image
          src={imageUrl ?? DEFAULT_COVER_IMAGE}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover"
        />
      </div>

      <CardHeader className="border-b pb-4 pt-4">
        <div className="flex items-center gap-2">
          <UserAvatar
            userId={authorId}
            name={displayName}
            avatarUrl={authorAvatarUrl}
            className="size-6 shrink-0"
          />
          <Link
            href={profileHref}
            className="text-sm font-medium hover:text-primary hover:underline"
          >
            {displayName}
          </Link>
          <span className="text-muted-foreground">·</span>
          <time
            dateTime={new Date(createdAt).toISOString()}
            className="text-xs text-muted-foreground"
          >
            {new Date(createdAt).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </time>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-4 flex-1">
        <Link href={postHref}>
          <h2 className="text-xl mb-3 font-semibold hover:text-primary">
            {title}
          </h2>
        </Link>
        {(tags ?? []).length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {(tags ?? []).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}
        <p className="text-muted-foreground line-clamp-3">{excerpt}</p>
      </CardContent>

      <CardFooter className="border-t pt-4 flex items-center justify-between">
        <span className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {commentCount}
          </span>
          <LikeButton postId={postId} isLiked={isLiked} likeCount={likeCount} />
          <BookmarkButton postId={postId} />
        </span>
        <Link
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "hover:text-primary hover:no-underline",
          )}
          href={postHref}
        >
          Read More
        </Link>
      </CardFooter>
    </Card>
  );
}
