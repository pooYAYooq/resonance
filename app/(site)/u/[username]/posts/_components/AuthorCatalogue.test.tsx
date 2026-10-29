/**
 * Component tests for `AuthorCatalogue`.
 *
 * The catalogue is one reactive paginated stream over `listAuthorPosts`, so
 * these tests pin the native statuses (first load, load more, in-flight,
 * exhausted), the argument shape the hook is called with, and the failure
 * modes a live list must survive: a shorter or empty live result, a deletion
 * of the focused card, and a change of author that must never blend two
 * catalogues.
 *
 * `usePaginatedQuery` is mocked with a mutable state object so a rerender can
 * stand in for a live Convex update.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { usePaginatedQueryMock, loadMoreMock } = vi.hoisted(() => ({
  usePaginatedQueryMock: vi.fn(),
  loadMoreMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  usePaginatedQuery: (...args: unknown[]) => usePaginatedQueryMock(...args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { profiles: { listAuthorPosts: "listAuthorPosts" } },
}));

import { AuthorCatalogue } from "./AuthorCatalogue";
import type { AuthorCard } from "@/components/web/AuthorPostCard";

type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

interface QueryState {
  results: AuthorCard[];
  status: PaginationStatus;
  loadMore: () => void;
}

let state: QueryState;

function publish(next: Partial<QueryState>) {
  state = {
    results: [],
    status: "LoadingFirstPage",
    loadMore: loadMoreMock,
    ...next,
  };
}

const card = (n: number): AuthorCard => ({
  postId: `post-${n}`,
  title: `Post ${n}`,
  imageUrl: null,
  publishedAt: 1000 + n,
  tags: [],
  likeCount: n,
});

const twelve = Array.from({ length: 12 }, (_, index) => card(index + 1));

const cardLinks = () => screen.queryAllByRole("link", { name: /^post \d+$/i });

const catalogue = (
  props: { userId?: string; username?: string | null } = {},
) => (
  <AuthorCatalogue
    userId={props.userId ?? "author"}
    username={props.username === undefined ? "maya" : props.username}
  />
);

describe("AuthorCatalogue", () => {
  beforeEach(() => {
    usePaginatedQueryMock.mockReset();
    loadMoreMock.mockReset();
    publish({});
    usePaginatedQueryMock.mockImplementation(() => state);
  });

  it("streams the author's posts with the native first page size", () => {
    render(catalogue());

    expect(usePaginatedQueryMock).toHaveBeenCalledWith(
      "listAuthorPosts",
      { userId: "author" },
      { initialNumItems: 12 },
    );
  });

  it("announces the first load through a polite status instead of a placeholder grid", () => {
    render(catalogue());

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/loading/i);
    expect(cardLinks()).toHaveLength(0);
    expect(screen.queryByRole("button")).toBeNull();
    // The root is the focus-restore fallback, so it is always named even while
    // there is nothing focusable inside it.
    expect(
      screen.getByRole("region", { name: "Loading posts" }),
    ).toHaveAttribute("tabindex", "-1");
  });

  it("renders the newest-first page and loads twelve more on request", async () => {
    const user = userEvent.setup();
    publish({ results: twelve, status: "CanLoadMore" });

    render(catalogue());

    expect(cardLinks()).toHaveLength(12);
    expect(cardLinks().map((link) => link.getAttribute("href"))).toEqual(
      twelve.map((post) => `/blog/${post.postId}`),
    );

    const more = screen.getByRole("button", { name: "Load more" });
    expect(more).toBeEnabled();
    await user.click(more);

    expect(loadMoreMock).toHaveBeenCalledWith(12);
  });

  it("sizes card covers for the catalogue's own responsive column schedule", () => {
    publish({
      results: [{ ...card(1), imageUrl: "https://cdn.example/cover.png" }],
      status: "Exhausted",
    });

    const { container } = render(catalogue());

    const image = container.querySelector("img");
    expect(image).toBeTruthy();
    expect(image).toHaveAttribute(
      "sizes",
      "(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
    );
  });

  it("still offers continuation after a short nonfinal page", async () => {
    const user = userEvent.setup();
    publish({ results: [card(1), card(2)], status: "CanLoadMore" });

    render(catalogue());
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(loadMoreMock).toHaveBeenCalledWith(12);
    // A short page is not evidence of the end, so no invented exhausted state.
    expect(screen.queryByText(/no published posts/i)).toBeNull();
  });

  it("still offers continuation when a nonfinal page has no visible posts", async () => {
    const user = userEvent.setup();
    publish({ results: [], status: "CanLoadMore" });

    render(catalogue());

    expect(screen.queryByText(/no published posts/i)).toBeNull();
    expect(cardLinks()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(loadMoreMock).toHaveBeenCalledWith(12);
  });

  it("keeps the control focusable and guards repeat activation while loading", async () => {
    const user = userEvent.setup();
    publish({ results: twelve, status: "CanLoadMore" });

    const { rerender } = render(catalogue());

    const more = screen.getByRole("button", { name: "Load more" });
    more.focus();
    await user.keyboard("{Enter}");

    expect(loadMoreMock).toHaveBeenCalledTimes(1);

    publish({ results: twelve, status: "LoadingMore" });
    rerender(catalogue());

    const loading = screen.getByRole("button", { name: /loading/i });
    expect(loading).toBe(more);
    expect(loading).toHaveAttribute("aria-disabled", "true");
    expect(loading).not.toHaveAttribute("disabled");
    expect(loading).toBeEnabled();
    expect(loading).toHaveFocus();

    await user.click(loading);

    expect(loadMoreMock).toHaveBeenCalledTimes(1);
    expect(loading).toHaveFocus();
    expect(cardLinks()).toHaveLength(12);
    expect(screen.getByRole("status")).toHaveTextContent(/loading more/i);
  });

  it("hides the control once the catalogue is exhausted", () => {
    publish({ results: twelve, status: "Exhausted" });

    render(catalogue());

    expect(cardLinks()).toHaveLength(12);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("explains an empty catalogue and returns to the profile", () => {
    publish({ results: [], status: "Exhausted" });

    render(catalogue({ username: "MayaB" }));

    expect(screen.getByText(/no published posts/i)).toBeInTheDocument();
    expect(cardLinks()).toHaveLength(0);
    expect(screen.queryByRole("button")).toBeNull();

    const back = screen.getByRole("link", { name: /back to profile/i });
    expect(back).toHaveAttribute("href", "/u/mayab");
    expect(back).not.toHaveAttribute("target");
    expect(
      screen.getByRole("region", { name: "No posts yet" }),
    ).toBeInTheDocument();
  });

  it("omits the return link when the author has no username", () => {
    publish({ results: [], status: "Exhausted" });

    render(catalogue({ username: null }));

    expect(screen.getByText(/no published posts/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    // With no return control, the named region is the only focus context left.
    expect(
      screen.getByRole("region", { name: "No posts yet" }),
    ).toHaveAttribute("tabindex", "-1");
  });

  it("shrinks reactively on deletion without duplicates or blank slots", () => {
    publish({ results: twelve, status: "Exhausted" });

    const { rerender } = render(catalogue());
    const firstCard = cardLinks()[0];

    const survivors = [card(1), card(2), card(5), card(7)];
    publish({ results: survivors, status: "Exhausted" });
    rerender(catalogue());

    const links = cardLinks();
    expect(links).toHaveLength(4);
    expect(links[0]).toBe(firstCard);
    expect(screen.queryByRole("link", { name: "Post 3" })).toBeNull();
    expect(new Set(links.map((link) => link.getAttribute("href"))).size).toBe(
      4,
    );

    const list = screen.getByTestId("author-catalogue");
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  it("restores focus to the next card when the focused card is deleted", () => {
    publish({ results: twelve, status: "Exhausted" });

    const { rerender } = render(catalogue());
    cardLinks()[1].focus();
    expect(cardLinks()[1]).toHaveFocus();

    publish({ results: [card(1), card(3), card(4)], status: "Exhausted" });
    rerender(catalogue());

    expect(screen.getByRole("link", { name: "Post 3" })).toHaveFocus();
  });

  it("moves focus to the profile return link when the last card is deleted", () => {
    publish({ results: [card(1)], status: "Exhausted" });

    const { rerender } = render(catalogue());
    cardLinks()[0].focus();
    expect(cardLinks()[0]).toHaveFocus();

    publish({ results: [], status: "Exhausted" });
    rerender(catalogue());

    expect(screen.queryByRole("link", { name: "Post 1" })).toBeNull();
    expect(
      screen.getByRole("link", { name: /back to profile/i }),
    ).toHaveFocus();
  });

  it("keeps a named focus context when the last card is deleted without a username", () => {
    publish({ results: [card(1)], status: "Exhausted" });

    const { rerender } = render(catalogue({ username: null }));
    cardLinks()[0].focus();
    expect(cardLinks()[0]).toHaveFocus();

    publish({ results: [], status: "Exhausted" });
    rerender(catalogue({ username: null }));

    // No return link exists, so focus must land on the named empty context and
    // not on an unnamed container or the document body.
    const context = screen.getByRole("region", { name: "No posts yet" });
    expect(context).toHaveFocus();
    expect(context).toHaveAttribute("tabindex", "-1");
    expect(within(context).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("restores focus when a focused Load more control disappears at the end", () => {
    publish({ results: [card(1), card(2)], status: "CanLoadMore" });

    const { rerender } = render(catalogue());
    const more = screen.getByRole("button", { name: "Load more" });
    more.focus();
    expect(more).toHaveFocus();

    // The page request starts: the same control stays in the DOM, pending and
    // focusable, so the restore still knows where focus came from.
    publish({ results: [card(1), card(2)], status: "LoadingMore" });
    rerender(catalogue());

    const loading = screen.getByRole("button", { name: /loading/i });
    expect(loading).toBe(more);
    expect(loading).toHaveAttribute("aria-disabled", "true");
    expect(loading).not.toHaveAttribute("disabled");
    expect(loading).toHaveFocus();

    // The appended page is also the last one, so the control disappears.
    publish({ results: [card(1), card(2), card(3)], status: "Exhausted" });
    rerender(catalogue());

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Post 3" })).toHaveFocus();
  });

  it("never shows the previous author's posts after the author changes", () => {
    publish({ results: [card(1), card(2)], status: "CanLoadMore" });

    const { rerender } = render(catalogue({ userId: "author-a" }));
    expect(cardLinks()).toHaveLength(2);

    publish({ results: [], status: "LoadingFirstPage" });
    rerender(catalogue({ userId: "author-b", username: "other" }));

    expect(usePaginatedQueryMock).toHaveBeenLastCalledWith(
      "listAuthorPosts",
      { userId: "author-b" },
      { initialNumItems: 12 },
    );
    expect(cardLinks()).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("recovers a failed query through its boundary and retries the subscription", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const user = userEvent.setup();

    let failing = true;
    usePaginatedQueryMock.mockImplementation(() => {
      if (failing) throw new Error("query failed");
      return state;
    });

    render(catalogue());

    expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i);

    failing = false;
    publish({ results: [card(1)], status: "Exhausted" });
    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(screen.getByRole("link", { name: "Post 1" })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("mounts the next author's query after a failure without pressing Retry", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    let failing = true;
    usePaginatedQueryMock.mockImplementation(() => {
      if (failing) throw new Error("query failed");
      return state;
    });

    const { rerender } = render(catalogue({ userId: "author-a" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i);

    // The healthy author replaces the failed one; no Retry is pressed.
    failing = false;
    publish({ results: [card(1)], status: "Exhausted" });
    rerender(catalogue({ userId: "author-b", username: "other" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("link", { name: "Post 1" })).toBeInTheDocument();
    expect(usePaginatedQueryMock).toHaveBeenLastCalledWith(
      "listAuthorPosts",
      { userId: "author-b" },
      { initialNumItems: 12 },
    );
    consoleError.mockRestore();
  });
});
