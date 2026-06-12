/**
 * Component tests for the settings page.
 *
 * Verifies auth-gated redirect, form pre-fill from current user data,
 * and submission of the `updateProfile` mutation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsRoute from "./page";

const {
  pushMock,
  toastSuccessMock,
  toastErrorMock,
  updateProfileMock,
  useConvexAuthState,
  useQueryState,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  updateProfileMock: vi.fn(),
  useConvexAuthState: vi.fn(),
  useQueryState: vi.fn(),
}));

let currentQueryValue: unknown = undefined;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: () => useQueryState(),
  useMutation: () => updateProfileMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: {
      getCurrentUser: "getCurrentUser",
      updateProfile: "updateProfile",
    },
  },
}));

const currentUser = {
  _id: "users-1",
  _creationTime: 0,
  userId: "auth-user-1",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: "https://example.com/ada.png",
  bio: "Initial bio.",
  createdAt: 0,
};

describe("SettingsRoute", () => {
  beforeEach(() => {
    pushMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    updateProfileMock.mockClear();
    currentQueryValue = currentUser;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryState.mockImplementation(() => currentQueryValue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /auth/login when not authenticated", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<SettingsRoute />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/auth/login");
    });
  });

  it("does not redirect while auth is loading", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    render(<SettingsRoute />);

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("pre-fills the form with the current user's display name and bio", () => {
    render(<SettingsRoute />);

    const displayNameInput =
      screen.getByLabelText(/display name/i) as HTMLInputElement;
    const bioTextarea = screen.getByLabelText(/bio/i) as HTMLTextAreaElement;
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;

    expect(displayNameInput.value).toBe("Ada Lovelace");
    expect(bioTextarea.value).toBe("Initial bio.");
    expect(emailInput.value).toBe("ada@example.com");
  });

  it("shows a live character counter for the bio (max 160)", async () => {
    const user = userEvent.setup();
    render(<SettingsRoute />);

    const bioTextarea = screen.getByLabelText(/bio/i) as HTMLTextAreaElement;
    await user.clear(bioTextarea);
    await user.type(bioTextarea, "short");

    expect(
      screen.getByText((text) => text.replace(/\s+/g, " ") === "5 / 160 characters"),
    ).toBeInTheDocument();
  });

  it("submits the form and calls updateProfile with the trimmed values", async () => {
    const user = userEvent.setup();
    updateProfileMock.mockResolvedValue("users-1");

    render(<SettingsRoute />);

    const displayNameInput =
      screen.getByLabelText(/display name/i) as HTMLInputElement;
    const bioTextarea = screen.getByLabelText(/bio/i) as HTMLTextAreaElement;

    await user.clear(displayNameInput);
    await user.type(displayNameInput, "  Ada L.  ");
    await user.clear(bioTextarea);
    await user.type(bioTextarea, "New bio text.");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        displayName: "Ada L.",
        bio: "New bio text.",
      });
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Profile updated");
    });
  });

  it("shows an error toast when the mutation throws", async () => {
    const user = userEvent.setup();
    updateProfileMock.mockRejectedValue(new Error("Boom"));

    render(<SettingsRoute />);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to update profile");
    });
  });

  it("redirects to the user's profile after a successful save", async () => {
    const user = userEvent.setup();
    updateProfileMock.mockResolvedValue("users-1");

    render(<SettingsRoute />);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/u/auth-user-1");
    });
  });
});
