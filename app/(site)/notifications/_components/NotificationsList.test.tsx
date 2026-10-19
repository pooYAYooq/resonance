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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@/convex/_generated/dataModel";

const {
  useConvexAuthState,
  usePaginatedState,
  usePaginatedQueryArgsMock,
  useMutationMocks,
  useQueryArgsMock,
  useQueryState,
  pushMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  usePaginatedState: vi.fn(),
  usePaginatedQueryArgsMock: vi.fn(),
  useMutationMocks: {
    markAllRead: vi.fn(),
    markRead: vi.fn(),
  },
  useQueryArgsMock: vi.fn(),
  useQueryState: vi.fn(),
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
  useMutation: (ref: unknown) =>
    ref === "markAllRead"
      ? useMutationMocks.markAllRead
      : useMutationMocks.markRead,
  useQuery: (_query: unknown, args: unknown) => {
    useQueryArgsMock(args);
    return useQueryState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    notifications: {
      getNotifications: "getNotifications",
      markAllRead: "markAllRead",
      markRead: "markRead",
      getUnreadCount: "getUnreadCount",
    },
  },
}));

import { NotificationsList } from "./NotificationsList";

/**
 * Middle-button activation arrives as `auxclick`; this testing-library
 * version has no `fireEvent.auxClick` helper.
 */
const auxClick = (element: Element, button: number) =>
  fireEvent(
    element,
    new MouseEvent("auxclick", { bubbles: true, cancelable: true, button }),
  );

const baseNotification = (
  overrides: Partial<{
    _id: string;
    postTitle: string | null;
    actorName: string;
    createdAt: number;
    actorId: string;
    readAt: number | undefined;
  }> = {},
) => ({
  _id: (overrides._id ?? "notif-1") as Id<"notifications">,
  _creationTime: 0,
  recipientId: "me",
  actorId: (overrides.actorId ?? "actor-1") as string,
  postId: "post-1" as Id<"posts">,
  createdAt: overrides.createdAt ?? Date.now(),
  readAt: overrides.readAt,
  actorName: overrides.actorName ?? "Ada",
  actorUsername: "ada",
  actorAvatarUrl: null,
  postTitle: overrides.postTitle === undefined ? "Hello" : overrides.postTitle,
});

describe("NotificationsList", () => {
  beforeEach(() => {
    pushMock.mockClear();
    usePaginatedQueryArgsMock.mockClear();
    useQueryArgsMock.mockClear();
    useMutationMocks.markAllRead.mockReset();
    useMutationMocks.markAllRead.mockResolvedValue({ ok: true });
    useMutationMocks.markRead.mockReset();
    useMutationMocks.markRead.mockResolvedValue({ ok: true });
    useQueryState.mockReturnValue(0);
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
    expect(useQueryArgsMock).toHaveBeenCalledWith("skip");
    expect(useMutationMocks.markAllRead).not.toHaveBeenCalled();
    expect(useMutationMocks.markRead).not.toHaveBeenCalled();
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
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute(
      "href",
      "/blog",
    );
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

  it("shows the New marker only on unread notifications", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [
        baseNotification({ _id: "unread" }),
        baseNotification({ _id: "read", readAt: 123, actorId: "actor-2" }),
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<NotificationsList />);

    expect(screen.getAllByText("New")).toHaveLength(1);
  });

  it("marks a notification read when its post link is opened", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [baseNotification({ _id: "notif-42" })],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<NotificationsList />);

    await user.click(screen.getByRole("link", { name: "Hello" }));
    await waitFor(() =>
      expect(useMutationMocks.markRead).toHaveBeenCalledWith({
        notificationId: "notif-42",
      }),
    );
  });

  it("marks a notification read when its post link is opened by middle click", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [baseNotification({ _id: "notif-42" })],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<NotificationsList />);

    auxClick(screen.getByRole("link", { name: "Hello" }), 1);
    expect(useMutationMocks.markRead).toHaveBeenCalledWith({
      notificationId: "notif-42",
    });
  });

  it("does not mark read when a non-opening button is pressed on the post link", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [baseNotification({ _id: "notif-42" })],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<NotificationsList />);

    auxClick(screen.getByRole("link", { name: "Hello" }), 2);
    expect(useMutationMocks.markRead).not.toHaveBeenCalled();
  });

  it("does not mark read when the actor link is opened instead", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [baseNotification({ _id: "notif-42" })],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(<NotificationsList />);

    await user.click(screen.getByRole("link", { name: "Open Ada's profile" }));
    expect(useMutationMocks.markRead).not.toHaveBeenCalled();
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

    it("focuses the Discover recovery action when pagination exhausts with no visible rows", async () => {
      const user = userEvent.setup();
      setPage([], "CanLoadMore");
      const view = render(<NotificationsList />);
      screen.getByRole("button", { name: "Load more" }).focus();
      await user.keyboard("{Enter}");
      setPage([], "LoadingMore");
      view.rerender(<NotificationsList />);
      setPage([], "Exhausted");
      view.rerender(<NotificationsList />);
      expect(screen.getByRole("link", { name: "Discover" })).toHaveFocus();
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

  describe("mark all read", () => {
    const authenticated = () => {
      useConvexAuthState.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });
      usePaginatedState.mockReturnValue({
        results: [baseNotification()],
        status: "Exhausted",
        loadMore: vi.fn(),
        isLoading: false,
      });
    };

    it("does not mark all read merely on mount", () => {
      authenticated();
      render(<NotificationsList />);

      expect(useMutationMocks.markAllRead).not.toHaveBeenCalled();
    });

    it("does not call the mutations when unauthenticated", () => {
      useConvexAuthState.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });
      render(<NotificationsList />);
      expect(useMutationMocks.markAllRead).not.toHaveBeenCalled();
      expect(useMutationMocks.markRead).not.toHaveBeenCalled();
    });

    it("shows the action only while unread notifications remain", () => {
      authenticated();
      useQueryState.mockReturnValue(2);
      const view = render(<NotificationsList />);
      expect(
        screen.getByRole("button", { name: "Mark all read" }),
      ).toBeInTheDocument();

      useQueryState.mockReturnValue(0);
      view.rerender(<NotificationsList />);
      expect(
        screen.queryByRole("button", { name: "Mark all read" }),
      ).not.toBeInTheDocument();
    });

    it("calls markAllRead when the action is activated", async () => {
      const user = userEvent.setup();
      authenticated();
      useQueryState.mockReturnValue(1);
      render(<NotificationsList />);

      await user.click(screen.getByRole("button", { name: "Mark all read" }));
      expect(useMutationMocks.markAllRead).toHaveBeenCalledWith({});
    });

    it("disables the action while the mutation is pending", async () => {
      const user = userEvent.setup();
      authenticated();
      useQueryState.mockReturnValue(1);
      let resolveMarkAll!: () => void;
      useMutationMocks.markAllRead.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveMarkAll = resolve;
        }),
      );
      render(<NotificationsList />);

      const button = screen.getByRole("button", { name: "Mark all read" });
      await user.click(button);
      expect(button).toBeDisabled();

      await act(async () => {
        resolveMarkAll();
      });
    });

    it("shows the action when the loaded page leaves no visible rows but unread remain", () => {
      useConvexAuthState.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });
      useQueryState.mockReturnValue(4);
      usePaginatedState.mockReturnValue({
        results: [baseNotification({ _id: "deleted", postTitle: null })],
        status: "CanLoadMore",
        loadMore: vi.fn(),
        isLoading: false,
      });
      render(<NotificationsList />);

      expect(
        screen.queryByText("No notifications yet"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Mark all read" }),
      ).toBeInTheDocument();
    });

    it("still offers the action in the empty state when a stale count remains", () => {
      useConvexAuthState.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });
      useQueryState.mockReturnValue(2);
      usePaginatedState.mockReturnValue({
        results: [],
        status: "Exhausted",
        loadMore: vi.fn(),
        isLoading: false,
      });
      render(<NotificationsList />);

      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Mark all read" }),
      ).toBeInTheDocument();
    });

    it("returns focus to the named list region when the action clears the count on a filtered page", async () => {
      const user = userEvent.setup();
      useConvexAuthState.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });
      useQueryState.mockReturnValue(1);
      usePaginatedState.mockReturnValue({
        results: [baseNotification({ _id: "deleted", postTitle: null })],
        status: "CanLoadMore",
        loadMore: vi.fn(),
        isLoading: false,
      });
      const view = render(<NotificationsList />);

      await user.click(screen.getByRole("button", { name: "Mark all read" }));
      await waitFor(() =>
        expect(useMutationMocks.markAllRead).toHaveBeenCalled(),
      );

      useQueryState.mockReturnValue(0);
      view.rerender(<NotificationsList />);
      await waitFor(() =>
        expect(
          screen.getByRole("region", { name: "Notifications list" }),
        ).toHaveFocus(),
      );
    });

    it("returns focus to the named list region when the action clears the count", async () => {
      const user = userEvent.setup();
      authenticated();
      useQueryState.mockReturnValue(1);
      const view = render(<NotificationsList />);

      await user.click(screen.getByRole("button", { name: "Mark all read" }));
      await waitFor(() =>
        expect(useMutationMocks.markAllRead).toHaveBeenCalled(),
      );

      useQueryState.mockReturnValue(0);
      view.rerender(<NotificationsList />);
      await waitFor(() =>
        expect(
          screen.getByRole("region", { name: "Notifications list" }),
        ).toHaveFocus(),
      );
    });
  });
});
