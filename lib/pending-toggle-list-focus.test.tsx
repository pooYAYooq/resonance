import { useRef } from "react";
import Link from "next/link";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@/convex/_generated/dataModel";
import { LikeToggle } from "@/components/web/LikeToggle";
import { BookmarkButton } from "@/components/web/BookmarkButton";
import { useListFocusRestore } from "./use-list-focus-restore";

const { toggleLike, toggleBookmark } = vi.hoisted(() => ({
  toggleLike: vi.fn(),
  toggleBookmark: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: () => true,
  useMutation: () => toggleBookmark,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/convex/_generated/api", () => ({
  api: {
    bookmarks: {
      isBookmarked: "isBookmarked",
      toggleBookmark: "toggleBookmark",
    },
  },
}));

// Keep both real toggle components and the real restore hook. Only the
// external mutation/query boundary and the reactive list slice are controlled.
function Collection({ items }: { items: string[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useListFocusRestore(rootRef, '[data-slot="card"]', false);
  return (
    <div ref={rootRef}>
      {items.map((id) => (
        <article key={id} data-slot="card">
          <Link href={`/blog/${id}`}>Read {id}</Link>
          <LikeToggle
            isLiked={true}
            count={1}
            onToggle={toggleLike}
            ariaLabelLiked={`Unlike ${id}`}
            ariaLabelNotLiked={`Like ${id}`}
            toastLiked="Liked"
            toastUnliked="Unliked"
          />
          <BookmarkButton postId={id as Id<"posts">} isBookmarked={true} />
        </article>
      ))}
      {items.length === 0 && <Link href="/blog">Browse the Blog</Link>}
    </div>
  );
}

describe("pending shared toggles with collection removal", () => {
  beforeEach(() => {
    toggleLike.mockReset();
    toggleBookmark.mockReset();
  });

  it.each([
    { kind: "like", emptied: false },
    { kind: "like", emptied: true },
    { kind: "bookmark", emptied: false },
    { kind: "bookmark", emptied: true },
  ])(
    "restores after reactive $kind removal (emptied=$emptied)",
    async ({ kind, emptied }) => {
      let resolveLike!: (value: { liked: boolean; likeCount: number }) => void;
      let resolveBookmark!: (value: { bookmarked: boolean }) => void;
      toggleLike.mockImplementation(
        () =>
          new Promise((yes) => {
            resolveLike = yes;
          }),
      );
      toggleBookmark.mockImplementation(
        () =>
          new Promise((yes) => {
            resolveBookmark = yes;
          }),
      );
      const user = userEvent.setup();
      const view = render(
        <Collection items={emptied ? ["first"] : ["first", "second"]} />,
      );
      const button =
        kind === "like"
          ? screen.getByRole("button", { name: "Unlike first" })
          : screen.getAllByRole("button", {
              name: "Remove from reading list",
            })[0];
      button.focus();
      await user.keyboard("{Enter}");
      expect(button).toBeEnabled();
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute("aria-disabled", "true");
      // The reactive collection query can remove a row before the mutation's
      // promise settles. The unmounted toggle must not reclaim focus afterward.
      view.rerender(<Collection items={emptied ? [] : ["second"]} />);
      const target = emptied
        ? screen.getByRole("link", { name: "Browse the Blog" })
        : kind === "like"
          ? screen.getByRole("button", { name: "Unlike second" })
          : screen.getByRole("button", { name: "Remove from reading list" });
      expect(target).toHaveFocus();
      await act(async () => {
        if (kind === "like") resolveLike({ liked: false, likeCount: 0 });
        else resolveBookmark({ bookmarked: false });
      });
      expect(target).toHaveFocus();
    },
  );
});
