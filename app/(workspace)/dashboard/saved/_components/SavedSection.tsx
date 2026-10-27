"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { CollectionGroupList } from "@/components/web/CollectionGroupList";
import { EmptyState } from "@/components/web/EmptyState";
import { Button } from "@/components/ui/button";
import { Loader2, Bookmark } from "lucide-react";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";
import { collectionGroupStorageKey } from "@/lib/collection-group-storage";
import { groupCollectionPostsByTime } from "@/lib/collection-time-groups";
import { useListFocusRestore } from "@/lib/use-list-focus-restore";

export function SavedSection() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
    }
  }, [isLoading, isAuthenticated, router]);

  const queryArgs = !isLoading && isAuthenticated ? {} : "skip";

  const {
    results,
    status,
    loadMore,
    isLoading: listLoading,
  } = usePaginatedQuery(api.bookmarks.getBookmarkedPosts, queryArgs, {
    initialNumItems: 12,
  });

  const currentUser = useQuery(
    api.users.getCurrentUser,
    !isLoading && isAuthenticated ? {} : "skip",
  );
  const userLoading = isAuthenticated && currentUser === undefined;
  const groupStorageKey = currentUser?.userId
    ? collectionGroupStorageKey(currentUser.userId, "saved")
    : undefined;

  const rootRef = useRef<HTMLDivElement>(null);
  const [now] = useState(() => Date.now());
  useListFocusRestore(
    rootRef,
    '[data-slot="card"]',
    listLoading,
    "[data-list-header]",
  );

  if (isLoading || !isAuthenticated || userLoading) {
    return (
      <div className="flex justify-center py-12">
        <div role="status" aria-label="Loading saved posts">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (listLoading && results.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div role="status" aria-label="Loading saved posts">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!listLoading && results.length === 0 && status === "Exhausted") {
    return (
      <div ref={rootRef}>
        <EmptyState
          icon={Bookmark}
          title="No saved posts yet"
          description="Save posts to revisit later and they'll appear here."
          action={
            <Button asChild variant="outline">
              <Link href="/blog">Explore Discover</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const groups = groupCollectionPostsByTime(results, now);

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <CollectionGroupList
        groups={groups}
        collection="saved"
        persistenceKey={groupStorageKey}
      />

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => loadMore(12)}
            disabled={listLoading}
          >
            {listLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span className="ml-2">Loading more...</span>
              </>
            ) : (
              <span>Load more</span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
