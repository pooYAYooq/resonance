import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignUpPage from "./page";

const {
  pushMock,
  signUpMock,
  signInSocialMock,
  toastSuccessMock,
  toastErrorMock,
  searchParamsMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  signUpMock: vi.fn(),
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
    signUp: { email: signUpMock },
    signIn: { social: signInSocialMock },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("SignUpPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    signUpMock.mockClear();
    signInSocialMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    searchParamsMock.delete("returnTo");
  });

  it("shows validation error for short name", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByPlaceholderText("John Doe"), "ab");
    await user.type(
      screen.getByPlaceholderText("john@example.com"),
      "jane@example.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(
        screen.getByText((t) => t.includes("Too small")),
      ).toBeInTheDocument();
    });

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("shows validation error for short password", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByPlaceholderText("John Doe"), "Jane Doe");
    await user.type(
      screen.getByPlaceholderText("john@example.com"),
      "jane@example.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "short");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(
        screen.getByText((t) => t.includes("Too small")),
      ).toBeInTheDocument();
    });

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("redirects a direct sign-up to the dashboard", async () => {
    const user = userEvent.setup();
    signUpMock.mockImplementation(({ fetchOptions }) => {
      fetchOptions.onSuccess();
      return Promise.resolve({});
    });

    render(<SignUpPage />);

    await user.type(screen.getByPlaceholderText("John Doe"), "Jane Doe");
    await user.type(
      screen.getByPlaceholderText("john@example.com"),
      "jane@example.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
        fetchOptions: expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      });
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Account created successfully!",
      );
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("returns to a validated internal route after sign-up", async () => {
    const user = userEvent.setup();
    searchParamsMock.set("returnTo", "/blog/post-1?tag=design");
    signUpMock.mockImplementation(({ fetchOptions }) => {
      fetchOptions.onSuccess();
      return Promise.resolve({});
    });

    render(<SignUpPage />);

    await user.type(screen.getByPlaceholderText("John Doe"), "Jane Doe");
    await user.type(
      screen.getByPlaceholderText("john@example.com"),
      "jane@example.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/blog/post-1?tag=design");
    });
  });

  it("uses the validated return route for OAuth providers", async () => {
    const user = userEvent.setup();
    searchParamsMock.set("returnTo", "/u/user-1");
    render(<SignUpPage />);

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
    render(<SignUpPage />);

    await user.click(screen.getByRole("button", { name: "Google" }));

    expect(signInSocialMock).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/dashboard",
    });

    searchParamsMock.set("returnTo", "/auth/login");
    render(<SignUpPage />);

    await user.click(screen.getAllByRole("button", { name: "GitHub" })[1]);

    expect(signInSocialMock).toHaveBeenLastCalledWith({
      provider: "github",
      callbackURL: "/dashboard",
    });
  });

  it("preserves a validated return route in the login link", () => {
    searchParamsMock.set("returnTo", "/u/user-1");
    render(<SignUpPage />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fu%2Fuser-1",
    );
  });

  it("shows error toast on failed submit", async () => {
    const user = userEvent.setup();
    signUpMock.mockImplementation(({ fetchOptions }) => {
      fetchOptions.onError({ error: { message: "Email already in use" } });
      return Promise.resolve({});
    });

    render(<SignUpPage />);

    await user.type(screen.getByPlaceholderText("John Doe"), "Jane Doe");
    await user.type(
      screen.getByPlaceholderText("john@example.com"),
      "jane@example.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Email already in use");
    });

    expect(pushMock).not.toHaveBeenCalled();
  });
});
