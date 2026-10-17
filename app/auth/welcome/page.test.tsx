import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WelcomePage from "./page";

const { replaceMock, pushMock, dismissMock, useConvexAuthState, useQueryMock } =
  vi.hoisted(() => ({
    replaceMock: vi.fn(),
    pushMock: vi.fn(),
    dismissMock: vi.fn(),
    useConvexAuthState: vi.fn(),
    useQueryMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams("returnTo=%2Fdashboard"),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: () => useQueryMock(),
  useMutation: () => dismissMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    welcome: {
      getWelcomeState: "getWelcomeState",
      dismissWelcome: "dismissWelcome",
    },
  },
}));

describe("WelcomePage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    pushMock.mockReset();
    dismissMock.mockReset();
    dismissMock.mockResolvedValue(null);
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryMock.mockReturnValue({
      dismissed: false,
      username: "Reso_k7m4p9t2x6",
    });
  });

  it("greets the account with its generated username", () => {
    render(<WelcomePage />);
    expect(screen.getByText("Reso_k7m4p9t2x6")).toBeInTheDocument();
  });

  it("leaves for the return destination once dismissed", async () => {
    useQueryMock.mockReturnValue({
      dismissed: true,
      username: "Reso_k7m4p9t2x6",
    });
    render(<WelcomePage />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("dismisses and continues when closed", async () => {
    const user = userEvent.setup();
    render(<WelcomePage />);
    await user.click(screen.getByRole("button", { name: "Start exploring" }));
    await waitFor(() => expect(dismissMock).toHaveBeenCalled());
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("dismisses and opens the editor", async () => {
    const user = userEvent.setup();
    render(<WelcomePage />);
    await user.click(
      screen.getByRole("button", { name: "Choose my username" }),
    );
    await waitFor(() => expect(dismissMock).toHaveBeenCalled());
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/profile/edit"));
  });

  it("prompts a settled signed-out visitor to sign in", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<WelcomePage />);

    expect(screen.getByText("Sign in to continue.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fdashboard",
    );
  });

  it("keeps the editor destination when the account reports dismissed mid-exit", async () => {
    const user = userEvent.setup();
    let resolveDismiss: (value: null) => void = () => {};
    dismissMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveDismiss = resolve;
        }),
    );

    const { rerender } = render(<WelcomePage />);
    await user.click(
      screen.getByRole("button", { name: "Choose my username" }),
    );
    expect(dismissMock).toHaveBeenCalled();

    // The write is still in flight when the subscribed account state flips to
    // dismissed. The automatic return redirect must not fire for a dismissal
    // this page is performing.
    useQueryMock.mockReturnValue({
      dismissed: true,
      username: "Reso_k7m4p9t2x6",
    });
    rerender(<WelcomePage />);

    resolveDismiss(null);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/profile/edit"));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("still leaves for the destination when dismissal fails", async () => {
    const user = userEvent.setup();
    dismissMock.mockRejectedValue(new Error("offline"));

    render(<WelcomePage />);
    await user.click(screen.getByRole("button", { name: "Start exploring" }));

    await waitFor(() => expect(dismissMock).toHaveBeenCalled());
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("still opens the editor when dismissal fails", async () => {
    const user = userEvent.setup();
    dismissMock.mockRejectedValue(new Error("offline"));

    render(<WelcomePage />);
    await user.click(
      screen.getByRole("button", { name: "Choose my username" }),
    );

    await waitFor(() => expect(dismissMock).toHaveBeenCalled());
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/profile/edit"));
  });
});
