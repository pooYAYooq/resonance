import { isCanonicalPostTag, type PostTag } from "@/lib/constants/post-tags";

export type DiscoverMode =
  | { mode: "search"; query: string }
  | { mode: "topic"; tag: PostTag }
  | { mode: "latest" };

export interface DiscoverParams {
  q?: string | string[];
  tag?: string | string[];
  sort?: string | string[];
}

function firstParamValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// One normalized mode is the route contract shared by every child component.
export function normalizeDiscoverParams(params: DiscoverParams): DiscoverMode {
  const query = firstParamValue(params.q)?.trim();
  if (query) return { mode: "search", query };

  const tag = firstParamValue(params.tag);
  if (tag && isCanonicalPostTag(tag)) return { mode: "topic", tag };

  return { mode: "latest" };
}

export function buildDiscoverSearchLink(query: string): string {
  const trimmedQuery = query.trim();
  return trimmedQuery ? `/blog?q=${encodeURIComponent(trimmedQuery)}` : "/blog";
}

export function buildDiscoverTopicLink(tag: PostTag): string {
  return `/blog?tag=${encodeURIComponent(tag)}`;
}

export function buildDiscoverLatestLink(): string {
  return "/blog";
}
