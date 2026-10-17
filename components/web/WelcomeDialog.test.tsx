/**
 * Component tests for `WelcomeDialog`.
 *
 * Verifies the dashboard-scoped one-time welcome: it shows only for an
 * authenticated, undismissed account; it renders nothing while auth or the
 * query is unresolved; and all three close paths (button, Escape, backdrop)
 * close it and fire the account dismissal without ever leaking an unhandled
 * rejection when the write fails.
 */

import { fireEvent, render, screen } from "@testing-library/react";
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
    render(<WelcomeDialog />);

    expect(
      screen.getByRole("heading", { name: "Welcome to RESONANCE." }),
    ).toBeInTheDocument();
    expect(screen.getByText("We're glad you're here.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");

    // The approved "Sound canvas" artwork: 15 layered harmonic-wave paths on
    // its own 0 0 360 240 viewBox, distinct from the close button's icon.
    const artwork = screen
      .getByRole("dialog")
      .querySelector('svg[viewBox="0 0 360 240"]');
    expect(artwork).toBeInTheDocument();
    expect(artwork?.querySelectorAll("path")).toHaveLength(15);
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

    // The Radix overlay is the approved blurred backdrop. Pointer-down outside
    // the content is what Radix treats as an overlay dismissal.
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(backdrop as HTMLElement);
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

  it("traps focus inside the dialog so the dashboard behind stays inert", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <button type="button">Dashboard action</button>
        <WelcomeDialog />
      </>,
    );

    const dialog = screen.getByRole("dialog");
    // The dashboard control is rendered, but Radix marks the obscured page
    // inert: it is outside the accessible tree while the modal is open.
    expect(container.querySelector("button")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Dashboard action" }),
    ).not.toBeInTheDocument();

    // Focus starts inside, and forward and backward tabbing both stay inside
    // (there is a single focusable, so the trap loops on it).
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(container.querySelector("button")).not.toHaveFocus();
  });
});
