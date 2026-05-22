/**
 * Renders a single comment card with author metadata and a timestamp.
 * Used inside the comment list below each blog post.
 */

"use client";

import { MessageSquare } from "lucide-react";

interface CommentCardProps {
  authorName: string;
  body: string;
  createdAt: number;
}

/**
 * Displays a comment card with author name, creation date, and body text.
 *
 * @param props - `CommentCardProps`: comment data to render.
 * @returns JSX.Element: a styled comment card.
 */
export function CommentCard({ authorName, body, createdAt }: CommentCardProps) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="size-4 text-muted-foreground" />
        <span className="font-semibold text-sm">{authorName}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(createdAt).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          at{" "}
          {new Date(createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{body}</p>
    </div>
  );
}
