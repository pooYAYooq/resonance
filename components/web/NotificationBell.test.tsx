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
 *  - Click navigates to `/notifications`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./NotificationBell";

const { useConvexAuthState, useQueryState, pushMock } = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  useQueryState: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: () => useQueryState(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    notifications: {
      getUnreadCount: "getUnreadCount",
    },
  },
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryState.mockReturnValue(0);
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
  });

  it("renders null while auth is loading", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the bell with the no-unread label when count is 0", () => {
    useQueryState.mockReturnValue(0);
    render(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("99+")).not.toBeInTheDocument();
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

  it("navigates to /notifications on click", async () => {
    const user = userEvent.setup();
    useQueryState.mockReturnValue(5);
    render(<NotificationBell />);

    await user.click(
      screen.getByRole("button", { name: "Notifications, 5 unread" }),
    );
    expect(pushMock).toHaveBeenCalledWith("/notifications");
  });
});
