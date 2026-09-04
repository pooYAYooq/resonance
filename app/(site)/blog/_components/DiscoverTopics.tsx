import Link from "next/link";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { isCanonicalPostTag, type PostTag } from "@/lib/constants/post-tags";
import {
  buildDiscoverLatestLink,
  buildDiscoverTopicLink,
  type DiscoverMode,
} from "@/lib/discover";

type Topic = { tag: string; publishedCount: number };
type CanonicalTopic = Omit<Topic, "tag"> & { tag: PostTag };

interface DiscoverTopicsProps {
  mode?: DiscoverMode;
  topics?: Topic[];
}

// Topics owns the secondary rail and keeps every link on the canonical topic route.
export async function DiscoverTopics({
  mode,
  topics,
}: DiscoverTopicsProps = {}) {
  const resolvedTopics =
    topics ?? (await fetchAuthQuery(api.discover.getTopics, {}));
  const activeTag = mode?.mode === "topic" ? mode.tag : undefined;

  if (resolvedTopics.length === 0) {
    return (
      <aside aria-labelledby="discover-topics-heading" className="border p-5">
        <h2 id="discover-topics-heading" className="text-lg font-semibold">
          Topics
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          No topics available yet.
        </p>
        <Link
          href={buildDiscoverLatestLink()}
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Browse latest
        </Link>
      </aside>
    );
  }

  return (
    <aside aria-labelledby="discover-topics-heading" className="border p-5">
      <h2 id="discover-topics-heading" className="text-lg font-semibold">
        Topics
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {resolvedTopics
          .filter((topic): topic is CanonicalTopic =>
            isCanonicalPostTag(topic.tag),
          )
          .map(({ tag, publishedCount }) => (
            <li key={tag} className="flex items-center justify-between gap-3">
              <Link
                href={buildDiscoverTopicLink(tag)}
                aria-current={tag === activeTag ? "page" : undefined}
                className={
                  tag === activeTag
                    ? "font-medium text-primary underline underline-offset-4"
                    : "font-medium hover:text-primary hover:underline"
                }
              >
                {tag}
              </Link>
              <span className="text-xs text-muted-foreground">
                {publishedCount} {publishedCount === 1 ? "post" : "posts"}
              </span>
            </li>
          ))}
      </ul>
    </aside>
  );
}
