import type { ReactNode } from "react";
import Link from "next/link";
import { UserAvatar } from "./UserAvatar";
import { TagPill } from "./TagPill";

type ArticleAuthor = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
};

type PublishedMetadata = {
  publishedAt: number;
  updatedAt: number;
};

type PostArticleHeaderProps = {
  title: string;
  author: ArticleAuthor;
  tags: string[];
  published?: PublishedMetadata;
  interactive?: boolean;
  authorAction?: ReactNode;
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });
}

/**
 * The shared article title and attribution band for the published reader and
 * its noninteractive author preview.
 */
export function PostArticleHeader({
  title,
  author,
  tags,
  published,
  interactive = false,
  authorAction,
}: PostArticleHeaderProps) {
  return (
    <div>
      <h1 className="text-h1 font-bold mt-6 tracking-tight text-foreground font-serif">
        {title}
      </h1>
      <div className="mt-4 flex items-start gap-3" data-testid="article-byline">
        <UserAvatar
          userId={author.userId}
          name={author.name}
          avatarUrl={author.avatarUrl}
          className="size-10 shrink-0"
        />
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-h-10">
            {interactive ? (
              <Link
                href={`/u/${author.userId}`}
                className="min-w-0 wrap-anywhere text-base font-semibold text-foreground capitalize underline-offset-4 hover:text-primary hover:underline focus-visible:underline"
              >
                {author.name}
              </Link>
            ) : (
              <p className="min-w-0 wrap-anywhere text-base font-semibold text-foreground capitalize">
                {author.name}
              </p>
            )}
            {authorAction}
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {published ? (
              <>
                <p>
                  <span className="font-semibold text-foreground">
                    Published on:
                  </span>{" "}
                  {formatDate(published.publishedAt)}
                </p>
                {published.updatedAt > published.publishedAt && (
                  <p>
                    <span className="font-semibold text-foreground">
                      Updated on:
                    </span>{" "}
                    {formatDate(published.updatedAt)}
                  </p>
                )}
              </>
            ) : (
              <p>Not published yet</p>
            )}
          </div>
        </div>
      </div>
      {tags.length > 0 && (
        <nav aria-label="Post topics" className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) =>
            interactive ? (
              <TagPill key={tag} tag={tag} className="py-1" />
            ) : (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ),
          )}
        </nav>
      )}
    </div>
  );
}
