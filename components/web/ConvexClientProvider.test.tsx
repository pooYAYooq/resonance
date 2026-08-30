import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const { convexClientMock, betterAuthProviderMock } = vi.hoisted(() => ({
  convexClientMock: vi.fn(),
  betterAuthProviderMock: vi.fn(({ children }) => <>{children}</>),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: convexClientMock,
}));

vi.mock("@convex-dev/better-auth/react", () => ({
  ConvexBetterAuthProvider: betterAuthProviderMock,
}));

vi.mock("./AuthSync", () => ({
  AuthSync: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

import { ConvexClientProvider } from "./ConvexClientProvider";

describe("ConvexClientProvider", () => {
  it("constructs a client without globally waiting for authentication", () => {
    render(
      <ConvexClientProvider>
        <p>Public content</p>
      </ConvexClientProvider>,
    );

    expect(convexClientMock.mock.calls[0]?.[1]).not.toMatchObject({
      expectAuth: true,
    });
    expect(betterAuthProviderMock).toHaveBeenCalled();
  });
});
