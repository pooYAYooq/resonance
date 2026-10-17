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
});
