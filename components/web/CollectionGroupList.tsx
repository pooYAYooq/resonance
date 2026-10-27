"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CollectionPostSummary } from "@/convex/postSummary";
import type { CollectionTimeGroup } from "@/lib/collection-time-groups";
import {
  readCollapsedGroups,
  writeCollapsedGroups,
} from "@/lib/collection-group-storage";
import { cn } from "@/lib/utils";
import { CollectionPostCard } from "./CollectionPostCard";

type CollectionName = "saved" | "liked";

type CollectionGroupListProps = {
  groups: CollectionTimeGroup<CollectionPostSummary>[];
  collection: CollectionName;
  /** Session-scoped storage key; omitted when the signed-in user is unknown. */
  persistenceKey?: string;
};

/** Renders a collection as collapsible time groups. */
export function CollectionGroupList({
  groups,
  collection,
  persistenceKey,
}: CollectionGroupListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => readCollapsedGroups(persistenceKey),
  );

  useEffect(() => {
    setCollapsedGroups(readCollapsedGroups(persistenceKey));
  }, [persistenceKey]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      writeCollapsedGroups(persistenceKey, next);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const collapsed = collapsedGroups.has(group.key);
        const panelId = `collection-${collection}-${group.key}-panel`;
        const headingId = `${panelId}-heading`;

        return (
          <section key={group.key} aria-labelledby={headingId}>
            <h2 id={headingId}>
              <button
                type="button"
                data-list-header
                aria-expanded={!collapsed}
                aria-controls={panelId}
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center gap-2 rounded-md px-0 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:bg-muted/50 sm:px-4"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    collapsed && "-rotate-90",
                  )}
                />
                <span>{group.label}</span>
                <span className="text-sm font-normal tabular-nums text-muted-foreground">
                  {group.posts.length}
                </span>
              </button>
            </h2>

            <div
              id={panelId}
              hidden={collapsed}
              className="mt-3 grid grid-cols-1 items-start gap-0 sm:gap-4 xl:grid-cols-2 xl:items-stretch"
            >
              {group.posts.map((post) => (
                <CollectionPostCard
                  key={post._id}
                  postId={post._id}
                  title={post.title}
                  tags={post.tags}
                  imageUrl={post.imageUrl}
                  commentCount={post.commentCount}
                  likeCount={post.likeCount ?? 0}
                  isLiked={post.isLiked ?? false}
                  isBookmarked={
                    collection === "saved" ? true : post.isBookmarked
                  }
                  collection={collection}
                  authorId={post.authorId}
                  authorName={post.authorName}
                  authorUsername={post.authorUsername}
                  authorAvatarUrl={post.authorAvatarUrl}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
