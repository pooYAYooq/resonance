/**
 * Component tests for `NotificationsList`.
 *
 * Mirrors `ReadingListContent.test.tsx`'s gate-testing precedent and
 * the `Navbar.test.tsx` `vi.hoisted` mocking pattern for
 * `useConvexAuth` / `usePaginatedQuery` / `useMutation`. Verifies:
 *  - Redirects to `/auth/login` when not authenticated.
 *  - Skips the paginated query (`"skip"` args) while unauthenticated.
 *  - Renders one `NotificationRow` per hydrated notification.
 *  - Renders `EmptyState` when the page is empty.
 *  - Renders the "Load more" button when `status === "CanLoadMore"`.
 *  - Calls `markAllRead` exactly once on mount when authenticated.
 *  - Filters out rows with `postTitle === null` (deleted post).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@/convex/_generated/dataModel";

const {
  useConvexAuthState,
  usePaginatedState,
  usePaginatedQueryArgsMock,
  useMutationMock,
  pushMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  usePaginatedState: vi.fn(),
  usePaginatedQueryArgsMock: vi.fn(),
  useMutationMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    usePaginatedQueryArgsMock(args);
    return usePaginatedState();
  },
  useMutation: () => useMutationMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    notifications: {
      getNotifications: "getNotifications",
      markAllRead: "markAllRead",
      getUnreadCount: "getUnreadCount",
    },
  },
}));

import { NotificationsList } from "./NotificationsList";

const baseNotification = (
  overrides: Partial<{
    _id: string;
    postTitle: string | null;
    actorName: string;
    createdAt: number;
    actorId: string;
  }> = {},
) => ({
  _id: (overrides._id ?? "notif-1") as Id<"notifications">,
  _creationTime: 0,
  recipientId: "me",
  actorId: (overrides.actorId ?? "actor-1") as string,
  postId: "post-1" as Id<"posts">,
  createdAt: overrides.createdAt ?? Date.now(),
  actorName: overrides.actorName ?? "Ada",
  actorAvatarUrl: null,
  postTitle: overrides.postTitle === undefined ? "Hello" : overrides.postTitle,
});

describe("NotificationsList", () => {
  beforeEach(() => {
    pushMock.mockClear();
    usePaginatedQueryArgsMock.mockClear();
    useMutationMock.mockReset();
    useMutationMock.mockResolvedValue({ ok: true });
    usePaginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /auth/login when unauthenticated", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    window.history.replaceState({}, "", "/notifications?unread=true#new");
    render(<NotificationsList />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fnotifications%3Funread%3Dtrue%23new",
      ),
    );
    expect(usePaginatedQueryArgsMock).toHaveBeenCalledWith("skip");
  });

  it("shows a loading spinner while auth is resolving", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    const { container } = render(<NotificationsList />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("skips private notifications operations while authenticated auth is resolving", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
    });
    render(<NotificationsList />);

    expect(usePaginatedQueryArgsMock).toHaveBeenCalledWith("skip");
    expect(useMutationMock).not.toHaveBeenCalled();
  });

  it("shows a loading spinner while the first page is loading", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
      isLoading: true,
    });
    const { container } = render(<NotificationsList />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders the empty state when authenticated with no notifications", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<NotificationsList />);

    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    expect(
      screen.getByText(/when an author you follow publishes a new post/i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(usePaginatedQueryArgsMock).toHaveBeenCalledWith({});
  });

  it("renders one NotificationRow per hydrated notification", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [
        baseNotification({ _id: "n-1", actorName: "Ada", postTitle: "Post A" }),
        baseNotification({
          _id: "n-2",
          actorName: "Bob",
          postTitle: "Post B",
          actorId: "actor-2",
        }),
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<NotificationsList />);

    expect(screen.getByText("Post A")).toBeInTheDocument();
    expect(screen.getByText("Post B")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("filters out rows whose postTitle is null (post deleted)", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [
        baseNotification({ _id: "n-1", postTitle: "Visible" }),
        baseNotification({ _id: "n-2", postTitle: null }),
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<NotificationsList />);

    expect(screen.getByText("Visible")).toBeInTheDocument();
    expect(screen.queryByText("published a new post")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("keeps Load more (not EmptyState) when all loaded rows are deleted-post and more pages remain", async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [
        baseNotification({ _id: "n-1", postTitle: null }),
        baseNotification({ _id: "n-2", postTitle: null }),
      ],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });
    render(<NotificationsList />);

    expect(screen.queryByText("No notifications yet")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: /load more/i });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(loadMore).toHaveBeenCalledWith(12);
  });

  it("renders the Load more button when status is CanLoadMore and triggers loadMore on click", async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [baseNotification()],
      status: "CanLoadMore",
      loadMore,
      isLoading: false,
    });
    render(<NotificationsList />);

    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(loadMore).toHaveBeenCalledWith(12);
  });

  describe("pagination focus", () => {
    const first = baseNotification({ _id: "first", actorName: "Ada" });
    const appended = baseNotification({
      _id: "next",
      actorName: "Bob",
      actorId: "actor-2",
    });
    const setPage = (
      results: ReturnType<typeof baseNotification>[],
      status: string,
    ) => {
      usePaginatedState.mockReturnValue({
        results,
        status,
        loadMore: vi.fn(),
        isLoading: status === "LoadingMore",
      });
    };

    beforeEach(() => {
      useConvexAuthState.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });
    });

    it.each(["CanLoadMore", "Exhausted"])(
      "focuses the first appended notification when the page settles as %s",
      async (status) => {
        const user = userEvent.setup();
        setPage([first], "CanLoadMore");
        const view = render(<NotificationsList />);
        screen.getByRole("button", { name: "Load more" }).focus();
        await user.keyboard("{Enter}");
        setPage([first], "LoadingMore");
        view.rerender(<NotificationsList />);
        expect(
          screen.getByRole("link", { name: "Open Ada's profile" }),
        ).not.toHaveFocus();
        setPage([first, appended], status);
        view.rerender(<NotificationsList />);
        expect(
          screen.getByRole("link", { name: "Open Bob's profile" }),
        ).toHaveFocus();
      },
    );

    it("preserves pagination tracking across an empty loading render", async () => {
      const user = userEvent.setup();
      const deleted = baseNotification({ postTitle: null });
      setPage([deleted], "CanLoadMore");
      const view = render(<NotificationsList />);
      screen.getByRole("button", { name: "Load more" }).focus();
      await user.keyboard("{Enter}");
      setPage([deleted], "LoadingMore");
      view.rerender(<NotificationsList />);
      setPage([deleted, appended], "Exhausted");
      view.rerender(<NotificationsList />);
      expect(
        screen.getByRole("link", { name: "Open Bob's profile" }),
      ).toHaveFocus();
    });

    it("preserves tracking when Chromium emits focusout before disconnecting pagination", () => {
      setPage([first], "CanLoadMore");
      const view = render(<NotificationsList />);
      const button = screen.getByRole("button", { name: "Load more" });
      button.focus();
      // Chromium emits this during DOM removal, while isConnected is still
      // true. jsdom does not emit it automatically when a node is removed.
      fireEvent.focusOut(button, { relatedTarget: null });
      setPage([first], "LoadingMore");
      view.rerender(<NotificationsList />);
      setPage([first, appended], "Exhausted");
      view.rerender(<NotificationsList />);
      expect(
        screen.getByRole("link", { name: "Open Bob's profile" }),
      ).toHaveFocus();
    });

    it("drops tracking after a deliberate blur while pagination remains connected", async () => {
      setPage([first], "CanLoadMore");
      const view = render(<NotificationsList />);
      const button = screen.getByRole("button", { name: "Load more" });
      button.focus();
      button.blur();
      await Promise.resolve();
      setPage([first], "LoadingMore");
      view.rerender(<NotificationsList />);
      setPage([first, appended], "Exhausted");
      view.rerender(<NotificationsList />);
      expect(document.body).toHaveFocus();
    });

    it("restores the replacement pagination control when a page adds no visible notifications", async () => {
      const user = userEvent.setup();
      setPage([first], "CanLoadMore");
      const view = render(<NotificationsList />);
      screen.getByRole("button", { name: "Load more" }).focus();
      await user.keyboard("{Enter}");
      setPage([first], "LoadingMore");
      view.rerender(<NotificationsList />);
      setPage(
        [first, baseNotification({ _id: "deleted", postTitle: null })],
        "CanLoadMore",
      );
      view.rerender(<NotificationsList />);
      expect(screen.getByRole("button", { name: "Load more" })).toHaveFocus();

      await user.keyboard("{Enter}");
      setPage([first], "LoadingMore");
      view.rerender(<NotificationsList />);
      setPage([first, appended], "Exhausted");
      view.rerender(<NotificationsList />);
      expect(
        screen.getByRole("link", { name: "Open Bob's profile" }),
      ).toHaveFocus();
    });

    it("returns to a surviving row when an exhausted page adds no visible notifications", async () => {
      const user = userEvent.setup();
      setPage([first], "CanLoadMore");
      const view = render(<NotificationsList />);
      screen.getByRole("button", { name: "Load more" }).focus();
      await user.keyboard("{Enter}");
      setPage([first], "LoadingMore");
      view.rerender(<NotificationsList />);
      setPage([first], "Exhausted");
      view.rerender(<NotificationsList />);
      expect(
        screen.getByRole("link", { name: "Open Ada's profile" }),
      ).toHaveFocus();
    });

    it("focuses the empty notification context when pagination exhausts with no visible rows", async () => {
      const user = userEvent.setup();
      setPage([], "CanLoadMore");
      const view = render(<NotificationsList />);
      screen.getByRole("button", { name: "Load more" }).focus();
      await user.keyboard("{Enter}");
      setPage([], "LoadingMore");
      view.rerender(<NotificationsList />);
      setPage([], "Exhausted");
      view.rerender(<NotificationsList />);
      expect(
        screen.getByRole("region", { name: "Notifications list" }),
      ).toHaveFocus();
      expect(screen.getByText("No notifications yet")).toBeVisible();
    });

    it("does not pull focus back when the user leaves pagination before loading", async () => {
      const user = userEvent.setup();
      setPage([first], "CanLoadMore");
      const content = () => (
        <>
          <NotificationsList />
          <button>Outside target</button>
        </>
      );
      const view = render(content());
      screen.getByRole("button", { name: "Load more" }).focus();
      await user.keyboard("{Enter}");
      screen.getByRole("button", { name: "Outside target" }).focus();
      setPage([first], "LoadingMore");
      view.rerender(content());
      setPage([first, appended], "Exhausted");
      view.rerender(content());
      expect(
        screen.getByRole("button", { name: "Outside target" }),
      ).toHaveFocus();
    });
  });

  it("calls markAllRead exactly once on mount when authenticated", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<NotificationsList />);

    await waitFor(() => expect(useMutationMock).toHaveBeenCalledTimes(1));
    expect(useMutationMock).toHaveBeenCalledWith({});
  });

  it("does not call markAllRead when unauthenticated", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<NotificationsList />);
    expect(useMutationMock).not.toHaveBeenCalled();
  });
});
