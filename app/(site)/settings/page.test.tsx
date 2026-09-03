import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsRoute from "./page";

const {
  pushMock,
  useConvexAuthState,
  useQueryState,
  signOutUserMock,
  themeState,
  setThemeMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  useConvexAuthState: vi.fn(),
  useQueryState: vi.fn(),
  signOutUserMock: vi.fn(),
  themeState: { theme: "system", resolvedTheme: "dark" },
  setThemeMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: (_query: unknown, args: unknown) => useQueryState(args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { users: { getCurrentUser: "getCurrentUser" } },
}));

vi.mock("@/components/web/account-actions", () => ({
  signOutUser: signOutUserMock,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ ...themeState, setTheme: setThemeMock }),
}));

const currentUser = {
  _id: "users-1",
  _creationTime: 0,
  userId: "auth-user-1",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
  bio: "",
  createdAt: 0,
};

describe("SettingsRoute", () => {
  beforeEach(() => {
    pushMock.mockClear();
    signOutUserMock.mockClear();
    setThemeMock.mockClear();
    themeState.theme = "system";
    themeState.resolvedTheme = "dark";
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryState.mockReturnValue(currentUser);
  });

  afterEach(() => vi.clearAllMocks());

  it("shows only appearance and account configuration", () => {
    render(<SettingsRoute />);

    expect(
      screen.getByRole("heading", { name: /^settings$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /appearance/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /account/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/appearance/i)).toHaveValue("system");
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^bio$/i)).not.toBeInTheDocument();
  });

  it("skips the private user query while anonymous", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<SettingsRoute />);

    expect(useQueryState).toHaveBeenLastCalledWith("skip");
  });

  it("redirects anonymous visitors with the complete return path", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    window.history.replaceState({}, "", "/settings?tab=account#sign-out");
    render(<SettingsRoute />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fsettings%3Ftab%3Daccount%23sign-out",
      );
    });
  });

  it("uses the shared sign-out behavior from the account section", async () => {
    const user = userEvent.setup();
    render(<SettingsRoute />);

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOutUserMock).toHaveBeenCalledWith({ push: pushMock });
  });
});
