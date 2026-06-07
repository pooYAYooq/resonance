import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

const { pushMock, signInMock, toastSuccessMock, toastErrorMock } = vi.hoisted(
  () => ({
    pushMock: vi.fn(),
    signInMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: signInMock, social: vi.fn() },
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
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
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
      expect(
        screen.getByText(/invalid/i),
      ).toBeInTheDocument();
    });

    expect(signInMock).not.toHaveBeenCalled();
  });

  it("submits successfully and redirects", async () => {
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
      expect(pushMock).toHaveBeenCalledWith("/");
    });
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
