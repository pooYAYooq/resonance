/**
 * Bounded, live author work.
 *
 * The server passes the first showcase (`getShowcase`: surviving selection in
 * saved order, else the newest three published). This component then subscribes
 * to the public, viewer-independent query so edits and deletions show up
 * without a reload, falling back to the server value until the first result
 * arrives.
 *
 * The list is bounded: three cards to start, three more per reveal, and the
 * reveal disappears once everything is shown. A shrinking live result clamps
 * the visible count without dropping or remounting the surviving cards, and a
 * change of author resets the reveal. Keyboard focus is restored through
 * `useListFocusRestore` for both reveal (cards append) and deletion (cards
 * vanish).
 *
 * The focus-restoration root is always mounted and programmatically focusable,
 * even when the live result is empty, so deleting the final card moves focus to
 * a surviving context instead of stranding it on the document body. The polite
 * status is likewise persistent and always derived from the current visible and
 * live totals, so a live deletion can never leave a stale announcement on
 * screen; it is cleared on an author change and on the empty transition.
 */

"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  AuthorPostCard,
  type AuthorCard,
} from "@/components/web/AuthorPostCard";
import { Button } from "@/components/ui/button";
import { useListFocusRestore } from "@/lib/use-list-focus-restore";
import { buildProfilePath } from "@/lib/username";

export type ShowcaseView = {
  mode: "selected" | "latest";
  posts: AuthorCard[];
};

const INITIAL_VISIBLE = 3;
const REVEAL_STEP = 3;

interface AuthorShowcaseProps {
  /** Better Auth user ID of the author whose work is shown. */
  userId: string;
  /** Live canonical username, or null when none is claimed. */
  username: string | null;
  /** Server-rendered showcase, used until the live query resolves. */
  initialShowcase: ShowcaseView;
}

export function AuthorShowcase({
  userId,
  username,
  initialShowcase,
}: AuthorShowcaseProps) {
  const live = useQuery(api.profiles.getShowcase, { userId });
  const showcase = live ?? initialShowcase;
  const posts = showcase.posts;

  const [revealed, setRevealed] = useState(INITIAL_VISIBLE);
  const [lastUserId, setLastUserId] = useState(userId);
  const [announcing, setAnnouncing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  // A different author resets the reveal and its announcement. Adjusting during
  // render keeps the first paint at three cards without an extra empty pass.
  if (userId !== lastUserId) {
    setLastUserId(userId);
    setRevealed(INITIAL_VISIBLE);
    setAnnouncing(false);
  }

  useListFocusRestore(rootRef, "li", false);

  const hasWork = posts.length > 0;
  const visibleCount = Math.min(revealed, posts.length);
  const visible = posts.slice(0, visibleCount);
  const heading =
    showcase.mode === "selected" ? "A few of my favourites" : "Latest posts";
  const showReveal =
    showcase.mode === "selected" && visibleCount < posts.length;
  // Announce only after a reveal, and always from the current totals so a live
  // deletion (or an emptied list) updates or clears the message rather than
  // repeating the count captured when the button was pressed.
  const statusMessage =
    announcing && hasWork
      ? `Showing ${visibleCount} of ${posts.length} posts.`
      : "";

  function reveal() {
    setRevealed(Math.min(visibleCount + REVEAL_STEP, posts.length));
    setAnnouncing(true);
  }

  return (
    <div
      ref={rootRef}
      data-testid="author-showcase"
      tabIndex={-1}
      role={hasWork ? "region" : undefined}
      aria-labelledby={hasWork ? headingId : undefined}
      className="focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {hasWork ? (
        <div className="mt-2 border-t border-border px-[25px] pt-[31px] pb-8 md:px-[42px]">
          <div className="mb-[23px] flex items-baseline justify-between gap-5">
            <h2
              id={headingId}
              className="text-[20px] font-semibold tracking-[-0.045em] md:text-[21px]"
            >
              {heading}
            </h2>
            {username !== null ? (
              <Link
                href={`${buildProfilePath(username)}/posts`}
                className="flex shrink-0 items-center gap-2 text-[11px] whitespace-nowrap text-[#ab4a22] hover:underline md:text-[12px] dark:text-[#efa471]"
              >
                All my posts
                <ArrowRight aria-hidden="true" className="size-[15px]" />
              </Link>
            ) : null}
          </div>

          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {visible.map((post) => (
              <li key={post.postId} className="min-w-0">
                <AuthorPostCard post={post} />
              </li>
            ))}
          </ol>

          {showReveal ? (
            <div className="mt-[30px] text-center">
              {/*
                Keyed by the visible count so the focused control is replaced
                when the list grows; the focus-restore hook then moves focus
                into the first newly revealed card.
              */}
              <Button
                key={visibleCount}
                type="button"
                variant="outline"
                onClick={reveal}
              >
                More of my work
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/*
        Persistent polite status: mounted even when the work is empty so a live
        deletion updates or clears the announcement instead of stranding stale
        counts. It is visually hidden and reserves no space.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>
    </div>
  );
}
