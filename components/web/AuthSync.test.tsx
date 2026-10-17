/**
 * Component tests for `AuthSync`.
 *
 * Verifies that children always render, that a failed `syncUser` surfaces a
 * recoverable banner instead of being swallowed, and that the manual retry
 * clears the banner on success without leaking an unhandled rejection.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useConvexAuthState, useMutationMock } = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  useMutationMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useMutation: () => useMutationMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { users: { syncUser: "syncUser" } },
}));

import { AuthSync } from "./AuthSync";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("AuthSync", () => {
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useMutationMock.mockReset();
  });

  it("always renders its children", () => {
    useMutationMock.mockResolvedValue(undefined);
    render(
      <AuthSync>
        <p>Public content</p>
      </AuthSync>,
    );

    expect(screen.getByText("Public content")).toBeInTheDocument();
  });

  it("shows no alert when the sync succeeds", async () => {
    useMutationMock.mockResolvedValue(undefined);
    render(
      <AuthSync>
        <p>Public content</p>
      </AuthSync>,
    );

    await waitFor(() => expect(useMutationMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces a recoverable alert when the sync fails", async () => {
    useMutationMock.mockRejectedValueOnce(new Error("sync failed"));
    render(
      <AuthSync>
        <p>Public content</p>
      </AuthSync>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not finish setting up your account.",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    // Children stay rendered while the failure is visible.
    expect(screen.getByText("Public content")).toBeInTheDocument();
  });

  it("retries on demand and clears the alert on success", async () => {
    const user = userEvent.setup();
    useMutationMock
      .mockRejectedValueOnce(new Error("sync failed"))
      .mockResolvedValueOnce(undefined);
    render(
      <AuthSync>
        <p>Public content</p>
      </AuthSync>,
    );

    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(useMutationMock).toHaveBeenCalledTimes(2);
  });

  it("disables and relabels the button while retrying", async () => {
    const user = userEvent.setup();
    const pending = deferred<undefined>();
    useMutationMock
      .mockRejectedValueOnce(new Error("sync failed"))
      .mockReturnValueOnce(pending.promise);
    render(
      <AuthSync>
        <p>Public content</p>
      </AuthSync>,
    );

    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    const retrying = screen.getByRole("button", { name: "Retrying…" });
    expect(retrying).toBeDisabled();

    await act(async () => {
      pending.resolve(undefined);
    });
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("keeps the alert after a failed retry", async () => {
    const user = userEvent.setup();
    useMutationMock
      .mockRejectedValueOnce(new Error("sync failed"))
      .mockRejectedValueOnce(new Error("retry failed"));
    render(
      <AuthSync>
        <p>Public content</p>
      </AuthSync>,
    );

    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not finish setting up your account.",
    );
  });

  it("does not emit an unhandled rejection when the sync fails", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      useMutationMock.mockRejectedValueOnce(new Error("sync failed"));
      render(
        <AuthSync>
          <p>Public content</p>
        </AuthSync>,
      );

      await screen.findByRole("alert");
      // Drain the microtask queue so a stray rejection would surface.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
