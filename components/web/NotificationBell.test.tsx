/**
 * Component tests for `NotificationBell`.
 *
 * Mirrors `Navbar.test.tsx`'s `vi.hoisted` mocking pattern for
 * `useConvexAuth` and `useQuery`. Verifies:
 *  - Hidden (renders `null`) when unauthenticated or while auth is
 *    loading.
 *  - No badge when count is 0.
 *  - Badge shows the count when > 0.
 *  - Caps at "99+" when count is 100.
 *  - Click opens the drawer without navigation.
 *  - Passes `"skip"` to `useQuery` when unauthenticated/loading, `{}`
 *    when authenticated (avoids an unnecessary subscription).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./NotificationBell";

const { useConvexAuthState, useQueryState, useQueryArgsMock, pushMock } =
  vi.hoisted(() => ({
    useConvexAuthState: vi.fn(),
    useQueryState: vi.fn(),
    useQueryArgsMock: vi.fn(),
    pushMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: (_query: unknown, args: unknown) => {
    useQueryArgsMock(args);
    return useQueryState();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    notifications: {
      getUnreadCount: "getUnreadCount",
    },
  },
}));

vi.mock("@/app/(site)/notifications/_components/NotificationsList", () => ({
  NotificationsList: ({ header }: { header?: ReactNode }) => (
    <div>
      {header}
      <button>Expand notification</button>
      <a
        href="#comment-target"
        onClick={(event) => {
          event.preventDefault();
          pushMock("#comment-target");
        }}
      >
        Read comment
      </a>
    </div>
  ),
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryState.mockReturnValue(0);
    useQueryArgsMock.mockClear();
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders null when unauthenticated", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
    expect(useQueryArgsMock).toHaveBeenLastCalledWith("skip");
  });

  it("renders null while auth is loading", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
    });
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
    expect(useQueryArgsMock).toHaveBeenLastCalledWith("skip");
  });

  it("renders the bell with the no-unread label when count is 0", () => {
    useQueryState.mockReturnValue(0);
    render(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("99+")).not.toBeInTheDocument();
    expect(useQueryArgsMock).toHaveBeenLastCalledWith({});
  });

  it("renders the bell with the count in the label when count > 0", () => {
    useQueryState.mockReturnValue(3);
    render(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "Notifications, 3 unread" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps the badge at '99+' when count is 100", () => {
    useQueryState.mockReturnValue(100);
    render(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "Notifications, 100 unread" }),
    ).toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("anchors the unread badge to the bell button", () => {
    useQueryState.mockReturnValue(3);
    render(<NotificationBell />);
    const button = screen.getByRole("button", {
      name: "Notifications, 3 unread",
    });
    const badge = screen.getByText("3");
    expect(button).toContainElement(badge);
    // The absolutely positioned badge needs the button as its containing
    // block; without it the badge anchors to the sticky header instead.
    expect(button.className).toContain("relative");
  });

  it("opens without navigation and restores focus when dismissed", async () => {
    const user = userEvent.setup();
    useQueryState.mockReturnValue(5);
    render(<NotificationBell />);

    await user.click(
      screen.getByRole("button", { name: "Notifications, 5 unread" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Notifications, 5 unread" }),
    ).toHaveFocus();
  });
  it("keeps row actions open but closes for destination links", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(
      screen.getByRole("button", { name: "Expand notification" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Read comment" }));
    expect(pushMock).toHaveBeenCalledWith("#comment-target");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("updates the unread badge without opening the drawer", () => {
    const { rerender } = render(<NotificationBell />);
    useQueryState.mockReturnValue(4);
    rerender(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "Notifications, 4 unread" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
