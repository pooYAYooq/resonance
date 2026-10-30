"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Tags, X } from "lucide-react";
import {
  buildDiscoverLatestLink,
  buildDiscoverTopicLink,
  type DiscoverMode,
} from "@/lib/discover";
import { isCanonicalPostTag, type PostTag } from "@/lib/constants/post-tags";
import { orderBlogTopics, type BlogTopic } from "@/lib/blog-topics";
import { cn } from "@/lib/utils";

type CanonicalBlogTopic = Omit<BlogTopic, "tag"> & { tag: PostTag };

interface BlogTopicsMenuProps {
  topics: BlogTopic[];
  mode: DiscoverMode;
}

/**
 * The sub-`xl` topic selector. It is a disclosure, not a modal: the trigger
 * stays focused, the panel overlays the results without moving them, and
 * Escape or an outside click closes it. The `xl` sidebar remains the desktop
 * selector.
 */
export function BlogTopicsMenu({ topics, mode }: BlogTopicsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeTag = mode.mode === "topic" ? mode.tag : undefined;
  const canonicalTopics = orderBlogTopics(
    topics.filter((topic): topic is CanonicalBlogTopic =>
      isCanonicalPostTag(topic.tag),
    ),
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const clearTopic = () => {
    setOpen(false);
    triggerRef.current?.focus();
    router.push("/blog#blog-results");
  };

  if (canonicalTopics.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="relative w-full [@media(max-height:500px)_and_(orientation:landscape)]:w-64 sm:w-64 xl:hidden"
    >
      <div
        data-testid="blog-topics-control"
        className="flex h-14 w-full items-stretch border border-input bg-background shadow-xs"
      >
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls="blog-topics-panel"
          onClick={() => setOpen((current) => !current)}
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-none px-4 text-sm font-medium outline-none transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:bg-muted/40"
        >
          <Tags aria-hidden="true" className="size-4" />
          <span className="min-w-0 flex-1 truncate text-left">
            Topics
            {activeTag ? (
              <span className="text-muted-foreground">: {activeTag}</span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </button>
        {activeTag ? (
          <button
            type="button"
            aria-label="Clear topic"
            onClick={clearTopic}
            className="flex h-full w-11 shrink-0 items-center justify-center border-l border-input text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-muted">
              <X aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            </span>
          </button>
        ) : null}
      </div>

      {/* Absolute on purpose: opening the panel must not move the results. */}
      <div
        id="blog-topics-panel"
        role="region"
        aria-label="Topics"
        hidden={!open}
        data-state={open ? "open" : "closed"}
        className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[min(70vh,24rem)] overflow-y-auto rounded-sm border bg-background p-4 shadow-lg sm:left-auto sm:right-0 sm:w-96"
      >
        <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <li className="col-span-full border-b pb-2">
            <Link
              href={`${buildDiscoverLatestLink()}#blog-results`}
              aria-current={mode.mode === "latest" ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                "text-sm font-medium",
                mode.mode === "latest"
                  ? "text-primary"
                  : "hover:text-primary hover:underline",
              )}
            >
              All topics
            </Link>
          </li>
          {canonicalTopics.map(({ tag, publishedCount }) => (
            <li key={tag} className="flex items-center justify-between gap-3">
              <Link
                href={`${buildDiscoverTopicLink(tag)}#blog-results`}
                aria-current={tag === activeTag ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "text-sm font-medium",
                  tag === activeTag
                    ? "text-primary"
                    : "hover:text-primary hover:underline",
                )}
              >
                {tag}
              </Link>
              <span className="text-xs text-muted-foreground">
                {publishedCount} {publishedCount === 1 ? "post" : "posts"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
