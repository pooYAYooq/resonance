import { describe, expect, it, vi } from "vitest";
import { signOutUser } from "./account-actions";

const { signOutMock, successMock, errorMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  successMock: vi.fn(),
  errorMock: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: signOutMock } }));
vi.mock("sonner", () => ({
  toast: { success: successMock, error: errorMock },
}));

describe("signOutUser", () => {
  it("resolves only after authentication confirms success", async () => {
    let confirm!: () => void;
    signOutMock.mockImplementation(({ fetchOptions }) => {
      confirm = fetchOptions.onSuccess;
    });
    const push = vi.fn();
    const result = signOutUser({ push });
    expect(result).toBeInstanceOf(Promise);
    expect(push).not.toHaveBeenCalled();
    confirm();
    await expect(result).resolves.toEqual({ ok: true });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("reports authentication failure without redirecting", async () => {
    signOutMock.mockImplementation(({ fetchOptions }) => {
      fetchOptions.onError({ error: { message: "Connection lost" } });
    });
    const push = vi.fn();
    await expect(signOutUser({ push })).resolves.toEqual({
      ok: false,
      message: "Connection lost",
    });
    expect(push).not.toHaveBeenCalled();
  });
});
