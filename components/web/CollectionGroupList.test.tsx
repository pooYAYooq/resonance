import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@/convex/_generated/dataModel";
import type { CollectionPostSummary } from "@/convex/postSummary";
import type { CollectionTimeGroup } from "@/lib/collection-time-groups";

vi.mock("./CollectionPostCard", () => ({
  CollectionPostCard: ({ title }: { title: string }) => (
    <article data-slot="card">{title}</article>
  ),
}));

import { CollectionGroupList } from "./CollectionGroupList";

const post = {
  _id: "post-1" as Id<"posts">,
  title: "A saved post",
  body: "",
  tags: [],
  authorId: "user-abc",
  createdAt: 1,
  commentCount: 0,
  likeCount: 0,
  imageUrl: null,
  authorName: "Ada Lovelace",
  authorUsername: "ada",
  authorAvatarUrl: null,
  isLiked: false,
  isBookmarked: true,
  addedAt: 1,
} satisfies CollectionPostSummary;

const groups = [
  {
    key: "today",
    label: "Today",
    posts: [post],
  },
  {
    key: "yesterday",
    label: "Yesterday",
    posts: [
      {
        ...post,
        _id: "post-2" as Id<"posts">,
        title: "A yesterday post",
        addedAt: 2,
      },
    ],
  },
] satisfies CollectionTimeGroup<CollectionPostSummary>[];

describe("CollectionGroupList", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("starts expanded and toggles each group with the chevron heading", async () => {
    const user = userEvent.setup();
    render(<CollectionGroupList groups={groups} collection="saved" />);

    const today = screen.getByRole("button", { name: /Today/ });
    const panel = document.getElementById("collection-saved-today-panel");

    expect(today).toHaveAttribute("aria-expanded", "true");
    expect(today).toHaveAttribute(
      "aria-controls",
      "collection-saved-today-panel",
    );
    expect(panel).not.toHaveAttribute("hidden");
    expect(screen.getByText("A saved post")).toBeVisible();

    await user.click(today);

    expect(today).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("hidden");
    expect(screen.getByText("A saved post")).not.toBeVisible();
    expect(screen.getByText("A yesterday post")).toBeVisible();

    await user.click(today);

    expect(today).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("hidden");
    expect(screen.getByText("A saved post")).toBeVisible();
  });

  it("keeps one collection column until xl and two columns at xl", () => {
    render(<CollectionGroupList groups={groups} collection="saved" />);

    expect(document.getElementById("collection-saved-today-panel")).toHaveClass(
      "grid-cols-1",
      "xl:grid-cols-2",
      "xl:items-stretch",
    );
  });

  it("keeps the other group open when one group is collapsed", async () => {
    const user = userEvent.setup();
    render(<CollectionGroupList groups={groups} collection="liked" />);

    await user.click(screen.getByRole("button", { name: /Yesterday/ }));

    expect(
      document.getElementById("collection-liked-yesterday-panel"),
    ).toHaveAttribute("hidden");
    expect(
      document.getElementById("collection-liked-today-panel"),
    ).not.toHaveAttribute("hidden");
  });

  it("restores collapsed groups from session storage when remounted", async () => {
    const user = userEvent.setup();
    const persistenceKey = "collection-groups:user-1:saved";
    const first = render(
      <CollectionGroupList
        groups={groups}
        collection="saved"
        persistenceKey={persistenceKey}
      />,
    );
    const today = screen.getByRole("button", { name: /Today/ });

    await user.click(today);

    expect(today).toHaveAttribute("aria-expanded", "false");
    expect(JSON.parse(sessionStorage.getItem(persistenceKey) ?? "[]")).toEqual([
      "today",
    ]);

    first.unmount();

    render(
      <CollectionGroupList
        groups={groups}
        collection="saved"
        persistenceKey={persistenceKey}
      />,
    );

    expect(screen.getByRole("button", { name: /Today/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      document.getElementById("collection-saved-today-panel"),
    ).toHaveAttribute("hidden");
  });
});
