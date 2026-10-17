/**
 * Component tests for `WelcomeDialog`.
 *
 * Verifies the dashboard-scoped one-time welcome: it shows only for an
 * authenticated, undismissed account; it renders nothing while auth or the
 * query is unresolved; and all three close paths (button, Escape, backdrop)
 * close it and fire the account dismissal without ever leaking an unhandled
 * rejection when the write fails.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useConvexAuthState, useQueryMock, useMutationMock } = vi.hoisted(
  () => ({
    useConvexAuthState: vi.fn(),
    useQueryMock: vi.fn(),
    useMutationMock: vi.fn(),
  }),
);

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: () => useQueryMock(),
  useMutation: () => useMutationMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    welcome: {
      getWelcomeState: "getWelcomeState",
      dismissWelcome: "dismissWelcome",
    },
  },
}));

import { WelcomeDialog } from "./WelcomeDialog";

describe("WelcomeDialog", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryMock.mockReturnValue({ dismissed: false, username: null });
    useMutationMock.mockReset();
    useMutationMock.mockResolvedValue(null);
  });

  it("shows the welcome copy when authenticated and undismissed", () => {
    const { container } = render(<WelcomeDialog />);

    expect(
      screen.getByRole("heading", { name: "Welcome to RESONANCE." }),
    ).toBeInTheDocument();
    expect(screen.getByText("We're glad you're here.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    // The approved "Sound canvas" treatment renders its decorative artwork.
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders nothing once the account has dismissed it", () => {
    useQueryMock.mockReturnValue({ dismissed: true, username: null });
    render(<WelcomeDialog />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing while auth is unresolved", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<WelcomeDialog />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing while loading", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
    });
    useQueryMock.mockReturnValue(undefined);
    render(<WelcomeDialog />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing while the query is unresolved", () => {
    useQueryMock.mockReturnValue(undefined);
    render(<WelcomeDialog />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when the query returns null", () => {
    useQueryMock.mockReturnValue(null);
    render(<WelcomeDialog />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes and dismisses when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<WelcomeDialog />);

    await user.click(screen.getByRole("button", { name: "Close welcome" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useMutationMock).toHaveBeenCalledWith({});
  });

  it("closes and dismisses on Escape", async () => {
    const user = userEvent.setup();
    render(<WelcomeDialog />);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useMutationMock).toHaveBeenCalledWith({});
  });

  it("closes on a backdrop click but not on a click inside the card", async () => {
    const user = userEvent.setup();
    render(<WelcomeDialog />);

    await user.click(
      screen.getByRole("heading", { name: "Welcome to RESONANCE." }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("welcome-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useMutationMock).toHaveBeenCalledWith({});
  });

  it("still closes with no unhandled rejection when the dismissal write fails", async () => {
    const user = userEvent.setup();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      useMutationMock.mockRejectedValueOnce(new Error("offline"));
      render(<WelcomeDialog />);

      await user.click(screen.getByRole("button", { name: "Close welcome" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      // Drain the microtask queue so a stray rejection would surface.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("focuses the close button when it opens", () => {
    render(<WelcomeDialog />);

    expect(screen.getByRole("button", { name: "Close welcome" })).toHaveFocus();
  });
});
