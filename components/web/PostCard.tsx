/**
 * Shared blog post card used by the blog listing, the landing page's
 * `RecentPostsSection`, and the public profile page. Renders a cover
 * image, an author row that links to the author's profile, the post
 * title, a body excerpt, the comment count, a live like button, and
 * a "Read More" link to the post detail page.
 *
 * This component is a Server Component. It does not subscribe to Convex
 * queries directly, but it renders the `LikeButton` client component
 * which does. Parents are responsible for fetching the data via
 * `fetchQuery` (or `useQuery` for live updates) and passing the hydrated
 * fields as props.
 */

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { UserAvatar } from "./UserAvatar";
import { LikeButton } from "./LikeButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

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
}

/**
 * Renders a post card with a cover image, author header, title, body
 * excerpt, engagement metrics, and a "Read More" link. The card is
 * divided into three visual sections separated by borders: a header
 * with author info, a content area, and a footer with engagement
 * actions. See {@link PostCardProps} for field-level documentation.
 *
 * @param props - `PostCardProps`: post data to render.
 * @returns JSX.Element: a card linking to the post detail page.
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
}: PostCardProps) {
  const displayName = authorName?.trim() || "Unknown";
  const postHref = `/blog/${postId}`;
  const profileHref = `/u/${authorId}`;

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
        <p className="text-muted-foreground line-clamp-3">{body}</p>
      </CardContent>

      <CardFooter className="border-t pt-4 flex items-center justify-between">
        <span className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {commentCount}
          </span>
          <LikeButton
            postId={postId}
            isLiked={isLiked}
            likeCount={likeCount}
          />
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
