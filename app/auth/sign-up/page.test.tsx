import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignUpPage from "./page";

const { pushMock, signUpMock, toastSuccessMock, toastErrorMock } = vi.hoisted(
  () => ({
    pushMock: vi.fn(),
    signUpMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: signUpMock },
    signIn: { social: vi.fn() },
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
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
  });

  it("shows validation error for short name", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByPlaceholderText("John Doe"), "ab");
    await user.type(
      screen.getByPlaceholderText("john@example.com"),
      "jane@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("••••••••"),
      "password123",
    );
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

  it("submits successfully and redirects", async () => {
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
    await user.type(
      screen.getByPlaceholderText("••••••••"),
      "password123",
    );
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
      expect(pushMock).toHaveBeenCalledWith("/");
    });
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
    await user.type(
      screen.getByPlaceholderText("••••••••"),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Email already in use");
    });

    expect(pushMock).not.toHaveBeenCalled();
  });
});
