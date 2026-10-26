export const COLLECTION_TIME_GROUPS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "previous-7-days", label: "Previous 7 days" },
  { key: "previous-30-days", label: "Previous 30 days" },
  { key: "earlier", label: "Earlier" },
] as const;

export type CollectionTimeGroupKey =
  (typeof COLLECTION_TIME_GROUPS)[number]["key"];

export type CollectionTimeGroup<T extends { addedAt: number }> = {
  key: CollectionTimeGroupKey;
  label: string;
  posts: T[];
};

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfLocalDaysAgo(now: number, days: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.getTime();
}

/**
 * Groups collection items into rolling local-time buckets while preserving the
 * newest-first order within each bucket. Empty buckets are omitted.
 */
export function groupCollectionPostsByTime<T extends { addedAt: number }>(
  posts: readonly T[],
  now: number,
): CollectionTimeGroup<T>[] {
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = startOfLocalDaysAgo(now, 1);
  const sevenDaysStart = startOfLocalDaysAgo(now, 7);
  const thirtyDaysStart = startOfLocalDaysAgo(now, 30);
  const buckets = new Map<CollectionTimeGroupKey, T[]>();

  for (const post of posts) {
    let key: CollectionTimeGroupKey;
    if (post.addedAt >= todayStart) {
      key = "today";
    } else if (post.addedAt >= yesterdayStart) {
      key = "yesterday";
    } else if (post.addedAt >= sevenDaysStart) {
      key = "previous-7-days";
    } else if (post.addedAt >= thirtyDaysStart) {
      key = "previous-30-days";
    } else {
      key = "earlier";
    }

    const bucket = buckets.get(key) ?? [];
    bucket.push(post);
    buckets.set(key, bucket);
  }

  return COLLECTION_TIME_GROUPS.flatMap(({ key, label }) => {
    const bucket = buckets.get(key);
    return bucket && bucket.length > 0 ? [{ key, label, posts: bucket }] : [];
  });
}
