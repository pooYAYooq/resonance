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
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@/convex/_generated/dataModel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const {
  useConvexAuthState,
  usePaginatedState,
  usePaginatedQueryArgsMock,
  useMutationMocks,
  useQueryArgsMock,
  unreadCountState,
  notificationCountsState,
  pushMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  usePaginatedState: vi.fn(),
  usePaginatedQueryArgsMock: vi.fn(),
  useMutationMocks: {
    markAllRead: vi.fn(),
    markRead: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  },
  useQueryArgsMock: vi.fn(),
  unreadCountState: vi.fn(),
  notificationCountsState: vi.fn(),
  pushMock: vi.fn(),
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("@/components/web/FollowButton", () => ({
  FollowButton: () => null,
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
      : ref === "dismissAll"
        ? useMutationMocks.dismissAll
        : ref === "dismiss"
          ? useMutationMocks.dismiss
          : useMutationMocks.markRead,
  useQuery: (query: unknown, args: unknown) => {
    useQueryArgsMock(args);
    return query === "getNotificationCounts"
      ? notificationCountsState()
      : unreadCountState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    notifications: {
      getNotifications: "getNotifications",
      getNotificationCounts: "getNotificationCounts",
      markAllRead: "markAllRead",
      markRead: "markRead",
      dismiss: "dismiss",
      dismissAll: "dismissAll",
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

const hasFocus = (name: string) =>
  screen
    .getAllByRole("link", { name })
    .some((element) => element === document.activeElement);

async function openActionsMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "More notification actions" }),
  );
  return screen.findByRole("menu");
}

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
  type: "post_like" as const,
});

describe("NotificationsList", () => {
  beforeEach(() => {
    pushMock.mockClear();
    toastMock.mockClear();
    toastMock.error.mockClear();
    usePaginatedQueryArgsMock.mockClear();
    useQueryArgsMock.mockClear();
    useMutationMocks.markAllRead.mockReset();
    useMutationMocks.markAllRead.mockResolvedValue({ ok: true });
    useMutationMocks.markRead.mockReset();
    useMutationMocks.markRead.mockResolvedValue({ ok: true });
    useMutationMocks.dismiss.mockReset();
    useMutationMocks.dismiss.mockResolvedValue(null);
    useMutationMocks.dismissAll.mockReset();
    useMutationMocks.dismissAll.mockResolvedValue(null);
    unreadCountState.mockReturnValue(0);
    notificationCountsState.mockReturnValue({
      total: 0,
      read: 0,
      unread: 0,
      truncated: false,
    });
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
    window.history.replaceState(
      {},
      "",
      "/dashboard/notifications?unread=true#new",
    );
    render(<NotificationsList />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fdashboard%2Fnotifications%3Funread%3Dtrue%23new",
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

    expect(screen.getAllByText("Post A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Post B").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bob").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("article")).toHaveLength(2);
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

    expect(screen.getAllByText("Visible").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/liked your post/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("shows the mobile unread indicator only on unread notifications", () => {
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

    const mobileRows = screen.getAllByTestId("notification-mobile");
    expect(
      within(mobileRows[0]).getByRole("img", { name: "Unread" }),
    ).toBeInTheDocument();
    expect(
      within(mobileRows[1]).queryByRole("img", { name: "Unread" }),
    ).not.toBeInTheDocument();
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

    await user.click(screen.getByRole("link", { name: "Open Hello" }));
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

    auxClick(screen.getByRole("link", { name: "Open Hello" }), 1);
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

    auxClick(screen.getByRole("link", { name: "Open Hello" }), 2);
    expect(useMutationMocks.markRead).not.toHaveBeenCalled();
  });

  it("marks the notification read when the actor link is opened", async () => {
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

    await user.click(
      screen.getAllByRole("link", { name: "Open Ada's profile" })[0],
    );
    expect(useMutationMocks.markRead).toHaveBeenCalledWith({
      notificationId: "notif-42",
    });
  });

  it("dismisses after the row delete toast closes", async () => {
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

    await user.click(
      screen.getByRole("button", { name: /Actions for notification/ }),
    );
    const menu = await screen.findByRole("menu");
    await user.click(
      within(menu).getByRole("menuitem", { name: "Delete notification" }),
    );

    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(useMutationMocks.dismiss).not.toHaveBeenCalled();
    const options = toastMock.mock.calls.at(-1)?.[1] as {
      onAutoClose?: () => void;
    };
    options.onAutoClose?.();
    await waitFor(() =>
      expect(useMutationMocks.dismiss).toHaveBeenCalledWith({
        notificationId: "notif-42",
      }),
    );
  });

  it("lets a keyboard user undo deletion without leaving the modal drawer", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [baseNotification({ _id: "drawer-undo" })],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    render(
      <Sheet open>
        <SheetContent aria-describedby={undefined}>
          <NotificationsList header={<SheetTitle>Notifications</SheetTitle>} />
        </SheetContent>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    within(screen.getByTestId("notification-desktop"))
      .getByRole("button", { name: "Delete notification" })
      .focus();
    await user.keyboard("{Enter}");

    const undo = within(dialog).getByRole("button", { name: "Undo" });
    expect(undo).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("notification-desktop")).toBeInTheDocument();
    expect(useMutationMocks.dismiss).not.toHaveBeenCalled();
    const options = toastMock.mock.calls.at(-1)?.[1] as {
      onAutoClose: () => void;
    };
    act(() => options.onAutoClose());
    expect(useMutationMocks.dismiss).not.toHaveBeenCalled();
  });

  it("keeps pending Undo usable after the drawer list remounts", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [baseNotification({ _id: "reopened-drawer-undo" })],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    const content = <NotificationsList header={<h2>Notifications</h2>} />;
    const first = render(content);
    await user.click(
      screen.getByRole("button", { name: "Delete notification" }),
    );
    first.unmount();
    render(content);

    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("notification-desktop")).toBeInTheDocument();
    expect(hasFocus("Open Ada's profile")).toBe(true);
    expect(useMutationMocks.dismiss).not.toHaveBeenCalled();
  });

  it("restores recovery focus when a remounted drawer Undo expires", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    const page = {
      results: [baseNotification({ _id: "reopened-expiring-undo" })],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    };
    usePaginatedState.mockReturnValue(page);
    useMutationMocks.dismiss.mockImplementation(async () => {
      usePaginatedState.mockReturnValue({ ...page, results: [] });
    });
    const content = <NotificationsList header={<h2>Notifications</h2>} />;
    const first = render(content);
    await user.click(
      screen.getByRole("button", { name: "Delete notification" }),
    );
    first.unmount();
    render(content);
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    const options = toastMock.mock.calls.at(-1)?.[1] as {
      onAutoClose: () => void;
    };

    await act(async () => options.onAutoClose());

    expect(screen.getByRole("link", { name: "Discover" })).toHaveFocus();
  });

  it("commits an expired drawer deletion once and removes its Undo action", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    const page = {
      results: [baseNotification({ _id: "expired-drawer-undo" })],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    };
    usePaginatedState.mockReturnValue(page);
    useMutationMocks.dismiss.mockImplementation(async () => {
      usePaginatedState.mockReturnValue({ ...page, results: [] });
    });
    render(<NotificationsList header={<h2>Notifications</h2>} />);
    await user.click(
      screen.getByRole("button", { name: "Delete notification" }),
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    const options = toastMock.mock.calls.at(-1)?.[1] as {
      onAutoClose: () => void;
      onDismiss: () => void;
    };

    await act(async () => {
      options.onAutoClose();
      options.onDismiss();
    });

    expect(useMutationMocks.dismiss).toHaveBeenCalledExactlyOnceWith({
      notificationId: "expired-drawer-undo",
    });
    expect(
      screen.queryByRole("button", { name: "Undo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("removes Undo when its window expires while the server deletion is pending", async () => {
    const user = userEvent.setup();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [baseNotification({ _id: "pending-drawer-deletion" })],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    let finish!: () => void;
    useMutationMocks.dismiss.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    render(<NotificationsList header={<h2>Notifications</h2>} />);
    await user.click(
      screen.getByRole("button", { name: "Delete notification" }),
    );
    const options = toastMock.mock.calls.at(-1)?.[1] as {
      onAutoClose: () => void;
    };

    act(() => options.onAutoClose());

    expect(
      screen.queryByRole("button", { name: "Undo" }),
    ).not.toBeInTheDocument();
    await act(async () => finish());
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
        expect(hasFocus("Open Ada's profile")).toBe(false);
        setPage([first, appended], status);
        view.rerender(<NotificationsList />);
        expect(hasFocus("Open Bob's profile")).toBe(true);
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
      expect(hasFocus("Open Bob's profile")).toBe(true);
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
      expect(hasFocus("Open Bob's profile")).toBe(true);
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
      expect(hasFocus("Open Bob's profile")).toBe(true);
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
      expect(hasFocus("Open Ada's profile")).toBe(true);
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

  describe("mark all as read", () => {
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

    it("keeps the menu action available and disabled when nothing is unread", async () => {
      const user = userEvent.setup();
      authenticated();
      unreadCountState.mockReturnValue(2);
      const view = render(<NotificationsList />);
      const menu = await openActionsMenu(user);
      const item = within(menu).getByRole("menuitem", {
        name: "Mark all as read",
      });
      expect(item).not.toHaveAttribute("aria-disabled", "true");

      unreadCountState.mockReturnValue(0);
      view.rerender(<NotificationsList />);
      expect(
        within(menu).getByRole("menuitem", { name: "Mark all as read" }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("calls markAllRead when the action is activated", async () => {
      const user = userEvent.setup();
      authenticated();
      unreadCountState.mockReturnValue(1);
      render(<NotificationsList />);

      const menu = await openActionsMenu(user);
      await user.click(
        within(menu).getByRole("menuitem", { name: "Mark all as read" }),
      );
      expect(useMutationMocks.markAllRead).toHaveBeenCalledWith({});
    });

    it("disables the action while the mutation is pending", async () => {
      const user = userEvent.setup();
      authenticated();
      unreadCountState.mockReturnValue(1);
      let resolveMarkAll!: () => void;
      useMutationMocks.markAllRead.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveMarkAll = resolve;
        }),
      );
      render(<NotificationsList />);

      const menu = await openActionsMenu(user);
      await user.click(
        within(menu).getByRole("menuitem", { name: "Mark all as read" }),
      );
      const reopened = await openActionsMenu(user);
      expect(
        within(reopened).getByRole("menuitem", { name: "Mark all as read" }),
      ).toHaveAttribute("aria-disabled", "true");

      await act(async () => {
        resolveMarkAll();
      });
    });

    it("shows the menu action when the loaded page leaves no visible rows but unread remain", async () => {
      const user = userEvent.setup();
      useConvexAuthState.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });
      unreadCountState.mockReturnValue(4);
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
      const menu = await openActionsMenu(user);
      expect(
        within(menu).getByRole("menuitem", { name: "Mark all as read" }),
      ).toBeInTheDocument();
    });

    it("still offers the action in the empty state when a stale count remains", async () => {
      const user = userEvent.setup();
      useConvexAuthState.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });
      unreadCountState.mockReturnValue(2);
      usePaginatedState.mockReturnValue({
        results: [],
        status: "Exhausted",
        loadMore: vi.fn(),
        isLoading: false,
      });
      render(<NotificationsList />);

      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
      const menu = await openActionsMenu(user);
      expect(
        within(menu).getByRole("menuitem", { name: "Mark all as read" }),
      ).toBeInTheDocument();
    });

    it("returns focus to the named list region when the action clears the count on a filtered page", async () => {
      const user = userEvent.setup();
      useConvexAuthState.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });
      unreadCountState.mockReturnValue(1);
      usePaginatedState.mockReturnValue({
        results: [baseNotification({ _id: "deleted", postTitle: null })],
        status: "CanLoadMore",
        loadMore: vi.fn(),
        isLoading: false,
      });
      const view = render(<NotificationsList />);

      const menu = await openActionsMenu(user);
      await user.click(
        within(menu).getByRole("menuitem", { name: "Mark all as read" }),
      );
      await waitFor(() =>
        expect(useMutationMocks.markAllRead).toHaveBeenCalled(),
      );

      unreadCountState.mockReturnValue(0);
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
      unreadCountState.mockReturnValue(1);
      const view = render(<NotificationsList />);

      const menu = await openActionsMenu(user);
      await user.click(
        within(menu).getByRole("menuitem", { name: "Mark all as read" }),
      );
      await waitFor(() =>
        expect(useMutationMocks.markAllRead).toHaveBeenCalled(),
      );

      unreadCountState.mockReturnValue(0);
      view.rerender(<NotificationsList />);
      await waitFor(() =>
        expect(
          screen.getByRole("region", { name: "Notifications list" }),
        ).toHaveFocus(),
      );
    });
  });

  it("marks a follow notification read when its profile link is activated", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    usePaginatedState.mockReturnValue({
      results: [
        {
          ...baseNotification({ postTitle: null }),
          type: "follow" as const,
          postId: undefined,
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<NotificationsList />);
    fireEvent.click(screen.getAllByRole("link", { name: "Ada" })[0]);

    await waitFor(() => {
      expect(useMutationMocks.markRead).toHaveBeenCalledWith({
        notificationId: "notif-1",
      });
    });
  });

  it("omits redundant supporting copy in the empty state", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(<NotificationsList />);
    expect(
      screen.queryByText(/Likes, follows, and comments on your work/),
    ).not.toBeInTheDocument();
  });

  describe("delete all", () => {
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

    it("disables Delete all when there are no notifications", async () => {
      const user = userEvent.setup();
      authenticated();
      render(<NotificationsList />);

      const menu = await openActionsMenu(user);
      expect(
        within(menu).getByRole("menuitem", { name: "Delete all" }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("opens with Read only selected and deletes the read scope", async () => {
      const user = userEvent.setup();
      authenticated();
      notificationCountsState.mockReturnValue({
        total: 42,
        read: 36,
        unread: 6,
        truncated: false,
      });
      render(<NotificationsList />);

      const menu = await openActionsMenu(user);
      await user.click(
        within(menu).getByRole("menuitem", { name: "Delete all" }),
      );
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /Read only/ })).toBeChecked();

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      await waitFor(() =>
        expect(useMutationMocks.dismissAll).toHaveBeenCalledWith({
          scope: "read",
        }),
      );
    });

    it("shows an error toast when bulk deletion fails", async () => {
      const user = userEvent.setup();
      authenticated();
      notificationCountsState.mockReturnValue({
        total: 42,
        read: 36,
        unread: 6,
        truncated: false,
      });
      useMutationMocks.dismissAll.mockRejectedValueOnce(new Error("failed"));
      render(<NotificationsList />);

      const menu = await openActionsMenu(user);
      await user.click(
        within(menu).getByRole("menuitem", { name: "Delete all" }),
      );
      const dialog = await screen.findByRole("alertdialog");

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith(
          "Couldn't delete notifications. Please try again.",
        ),
      );
    });

    it("deletes the unread scope when selected", async () => {
      const user = userEvent.setup();
      authenticated();
      notificationCountsState.mockReturnValue({
        total: 42,
        read: 36,
        unread: 6,
        truncated: false,
      });
      render(<NotificationsList />);

      const menu = await openActionsMenu(user);
      await user.click(
        within(menu).getByRole("menuitem", { name: "Delete all" }),
      );
      const dialog = await screen.findByRole("alertdialog");
      await user.click(screen.getByRole("radio", { name: /Unread only/ }));
      expect(
        within(dialog).getByRole("button", { name: "Delete" }),
      ).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      await waitFor(() =>
        expect(useMutationMocks.dismissAll).toHaveBeenCalledWith({
          scope: "unread",
        }),
      );
    });
  });
});
