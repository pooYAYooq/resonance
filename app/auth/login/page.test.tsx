import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

const {
  pushMock,
  signInMock,
  signInSocialMock,
  toastSuccessMock,
  toastErrorMock,
  searchParamsMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  signInMock: vi.fn(),
  signInSocialMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  searchParamsMock: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: signInMock, social: signInSocialMock },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("LoginPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    signInMock.mockClear();
    signInSocialMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    searchParamsMock.delete("returnTo");
  });

  it("shows validation error for invalid email", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("Enter your email"),
      "not-an-email",
    );
    await user.type(
      screen.getByPlaceholderText("Enter your password"),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    });

    expect(signInMock).not.toHaveBeenCalled();
  });

  it("redirects a direct login to the dashboard", async () => {
    const user = userEvent.setup();
    signInMock.mockImplementation(({ fetchOptions }) => {
      fetchOptions.onSuccess();
      return Promise.resolve({});
    });

    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("Enter your email"),
      "jane@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Enter your password"),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "password123",
        fetchOptions: expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      });
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Logged in successfully!");
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("returns to a validated internal route after login", async () => {
    const user = userEvent.setup();
    searchParamsMock.set("returnTo", "/blog/post-1?tag=design");
    signInMock.mockImplementation(({ fetchOptions }) => {
      fetchOptions.onSuccess();
      return Promise.resolve({});
    });

    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("Enter your email"),
      "jane@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Enter your password"),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/blog/post-1?tag=design");
    });
  });

  it("uses the validated return route for OAuth providers", async () => {
    const user = userEvent.setup();
    searchParamsMock.set("returnTo", "/u/user-1");
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Google" }));
    await user.click(screen.getByRole("button", { name: "GitHub" }));

    expect(signInSocialMock).toHaveBeenNthCalledWith(1, {
      provider: "google",
      callbackURL: "/u/user-1",
    });
    expect(signInSocialMock).toHaveBeenNthCalledWith(2, {
      provider: "github",
      callbackURL: "/u/user-1",
    });
  });

  it("falls back to the dashboard for auth and external return targets", async () => {
    const user = userEvent.setup();
    searchParamsMock.set("returnTo", "https://example.com");
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Google" }));

    expect(signInSocialMock).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/dashboard",
    });

    searchParamsMock.set("returnTo", "/auth/sign-up");
    render(<LoginPage />);

    await user.click(screen.getAllByRole("button", { name: "GitHub" })[1]);

    expect(signInSocialMock).toHaveBeenLastCalledWith({
      provider: "github",
      callbackURL: "/dashboard",
    });
  });

  it("preserves a validated return route in the sign-up link", () => {
    searchParamsMock.set("returnTo", "/u/user-1");
    render(<LoginPage />);

    expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute(
      "href",
      "/auth/sign-up?returnTo=%2Fu%2Fuser-1",
    );
  });

  it("shows error toast on failed submit", async () => {
    const user = userEvent.setup();
    signInMock.mockImplementation(({ fetchOptions }) => {
      fetchOptions.onError({ error: { message: "Invalid credentials" } });
      return Promise.resolve({});
    });

    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("Enter your email"),
      "jane@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Enter your password"),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Invalid credentials");
    });

    expect(pushMock).not.toHaveBeenCalled();
  });
});
