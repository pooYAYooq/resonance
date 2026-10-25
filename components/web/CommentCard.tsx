/**
 * Renders a single comment card with author metadata, a timestamp, and a
 * like button. Used inside the comment list below each blog post.
 */

"use client";

import Link from "next/link";
import { CommentTimestamp } from "./CommentTimestamp";
import { UserAvatar } from "./UserAvatar";
import { CommentLikeButton } from "./CommentLikeButton";
import type { Id } from "@/convex/_generated/dataModel";
import { buildProfilePath } from "@/lib/username";

interface CommentCardProps {
  commentId: Id<"comments">;
  authorName: string;
  authorUsername: string | null;
  body: string;
  createdAt: number;
  authorId: string;
  authorAvatarUrl?: string | null;
  isLiked: boolean;
  likeCount: number;
}

export function CommentCard({
  commentId,
  authorName,
  authorUsername,
  body,
  createdAt,
  authorId,
  authorAvatarUrl,
  isLiked,
  likeCount,
}: CommentCardProps) {
  return (
    <div
      id={`comment-${commentId}`}
      tabIndex={-1}
      className="scroll-mt-24 border rounded-lg p-4 bg-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <UserAvatar
          userId={authorId}
          name={authorName}
          avatarUrl={authorAvatarUrl}
          className="size-8 shrink-0"
        />
        {authorUsername ? (
          <Link
            href={buildProfilePath(authorUsername)}
            className="font-semibold text-sm hover:text-primary hover:underline"
          >
            {authorName}
          </Link>
        ) : (
          <span className="font-semibold text-sm">{authorName}</span>
        )}
        <CommentTimestamp createdAt={createdAt} />
      </div>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{body}</p>
      <div data-comment-likes className="flex justify-end mt-2">
        <CommentLikeButton
          commentId={commentId}
          isLiked={isLiked}
          likeCount={likeCount}
        />
      </div>
    </div>
  );
}
