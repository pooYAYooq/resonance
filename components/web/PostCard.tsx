/**
 * Shared blog post card used by the blog listing, the landing page's
 * `RecentPostsSection`, and the public profile page. Renders a cover
 * image, an author row that links to the author's profile, the post
 * title, a body excerpt, the comment count, and a "Read More" link to
 * the post detail page.
 *
 * This component is a pure presentational Server Component — it does
 * not subscribe to Convex queries. Parents are responsible for fetching
 * the data via `fetchQuery` (or `useQuery` for live updates) and
 * passing the hydrated fields as props.
 */

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { UserAvatar } from "./UserAvatar";
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
 * Renders a post card with cover image, author row, title, body excerpt,
 * comment count, and a "Read More" link. See {@link PostCardProps} for
 * the field-level documentation.
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
  createdAt,
  authorId,
  authorName,
  authorAvatarUrl,
}: PostCardProps) {
  const displayName = authorName?.trim() || "Unknown";
  const postHref = `/blog/${postId}`;
  const profileHref = `/u/${authorId}`;

  return (
    <Card className="pt-0 gap-4 flex flex-col h-full">
      <div className="relative h-48 w-full overflow-hidden mb-8">
        {/*
          The hostname must be allowlisted in next.config.ts for Next.js
          Image optimization. The default cover image is a wallhaven URL
          that is already allowlisted.
        */}
        <Image
          src={imageUrl ?? DEFAULT_COVER_IMAGE}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover"
        />
      </div>

      <CardContent className="mb-0 flex-1">
        <div className="flex items-center gap-2 mb-3">
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
        </div>
        <Link href={postHref}>
          <h2 className="text-xl mb-4 font-semibold hover:text-primary">
            {title}
          </h2>
        </Link>
        <p className="text-muted-foreground line-clamp-3">{body}</p>
      </CardContent>
      <CardFooter className="mt-auto flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground flex items-center gap-3">
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </span>
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
        </span>
        <Link
          className={cn(
            buttonVariants({
              variant: "outline",
            }),
            "px-3 py-0 hover:text-primary hover:no-underline space-x-2",
          )}
          href={postHref}
        >
          Read More
        </Link>
      </CardFooter>
    </Card>
  );
}
