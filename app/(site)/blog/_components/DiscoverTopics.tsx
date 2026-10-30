import Link from "next/link";
import { X } from "lucide-react";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { isCanonicalPostTag, type PostTag } from "@/lib/constants/post-tags";
import {
  buildDiscoverLatestLink,
  buildDiscoverTopicLink,
  type DiscoverMode,
} from "@/lib/discover";
import { orderBlogTopics, type BlogTopic } from "@/lib/blog-topics";

type CanonicalTopic = Omit<BlogTopic, "tag"> & { tag: PostTag };

interface DiscoverTopicsProps {
  mode?: DiscoverMode;
  topics?: BlogTopic[];
}

// Topics owns the secondary rail and keeps every link on the canonical topic route.
export async function DiscoverTopics({
  mode,
  topics,
}: DiscoverTopicsProps = {}) {
  const resolvedTopics =
    topics ?? (await fetchAuthQuery(api.discover.getTopics, {}));
  const activeTag = mode?.mode === "topic" ? mode.tag : undefined;
  const orderedTopics = orderBlogTopics(
    resolvedTopics.filter((topic): topic is CanonicalTopic =>
      isCanonicalPostTag(topic.tag),
    ),
  );

  if (orderedTopics.length === 0) {
    return (
      <aside aria-labelledby="discover-topics-heading" className="border p-5">
        <h2 id="discover-topics-heading" className="text-lg font-semibold">
          Topics
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          No topics available yet.
        </p>
        <Link
          href={`${buildDiscoverLatestLink()}#blog-results`}
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Browse all posts
        </Link>
      </aside>
    );
  }

  return (
    <aside aria-labelledby="discover-topics-heading" className="border p-5">
      <h2 id="discover-topics-heading" className="text-lg font-semibold">
        Topics
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 xl:grid-cols-1">
        {orderedTopics.map(({ tag, publishedCount }) => (
          <li key={tag} className="flex items-center justify-between gap-3">
            <Link
              href={`${buildDiscoverTopicLink(tag)}#blog-results`}
              aria-current={tag === activeTag ? "page" : undefined}
              className={
                tag === activeTag
                  ? "font-medium text-primary"
                  : "font-medium hover:text-primary hover:underline"
              }
            >
              {tag}
            </Link>
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {publishedCount} {publishedCount === 1 ? "post" : "posts"}
              </span>
              {tag === activeTag ? (
                <Link
                  href={`${buildDiscoverLatestLink()}#blog-results`}
                  aria-label="Clear topic"
                  className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <X
                    aria-hidden="true"
                    className="size-3.5"
                    strokeWidth={2.5}
                  />
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
