import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import {
  AuthoringExitProvider,
  useAuthoringExit,
} from "./AuthoringExitProvider";
import userEvent from "@testing-library/user-event";
import { AccountMenu } from "./AccountMenu";

const {
  useConvexAuthState,
  useQueryState,
  signOutUserMock,
  pushMock,
  navigateMock,
} = vi.hoisted(() => ({
  useConvexAuthState: vi.fn(),
  useQueryState: vi.fn(),
  signOutUserMock: vi.fn(),
  pushMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: (_query: unknown, args: unknown) => useQueryState(args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { users: { getCurrentUser: "getCurrentUser" } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/create",
}));

vi.mock("@/components/web/account-actions", () => ({
  signOutUser: signOutUserMock,
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

function DirtyEditor() {
  const { register } = useAuthoringExit();
  useEffect(
    () =>
      register({
        getSession: () => ({
          sessionKey: "published-edit:p1",
          mode: "published-edit",
          proposal: {
            title: "Unsaved",
            body: '{"format":"blocknote@1","blocks":[]}',
            tags: [],
          },
          baseline: {
            title: "Saved",
            body: '{"format":"blocknote@1","blocks":[]}',
            tags: [],
          },
          selectedCover: false,
          pendingUploads: 0,
          failedMedia: false,
          saving: false,
          uncertain: false,
          coverRemoved: false,
        }),
        flushRecovery: () => ({ ok: true }),
        clearRecovery: () => ({ ok: true }),
        resumeRecovery: () => {},
        saveDraft: async () => ({ kind: "failed", message: "Not used" }),
        validateTarget: async () => ({ ok: true }),
        adoptTarget: () => {},
        startFresh: () => {},
        cancelUpdate: () => {},
        reconcile: async () => {},
      }),
    [register],
  );
  return null;
}

describe("AccountMenu", () => {
  it("guards sign out and restores the stable menu trigger on cancellation", async () => {
    const user = userEvent.setup();
    render(
      <AuthoringExitProvider>
        <DirtyEditor />
        <AccountMenu presentation="navbar" />
      </AuthoringExitProvider>,
    );
    const trigger = screen.getByRole("button", { name: /open user menu/i });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
    expect(signOutUserMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", {
        name: "Sign out?",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  beforeEach(() => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    useQueryState.mockReturnValue(currentUser);
    signOutUserMock.mockClear();
    pushMock.mockClear();
    navigateMock.mockClear();
  });

  afterEach(() => vi.clearAllMocks());

  it("renders the shared account destinations", async () => {
    const user = userEvent.setup();
    render(<AccountMenu presentation="navbar" />);

    await user.click(screen.getByRole("button", { name: /open user menu/i }));

    expect(screen.getByRole("menuitem", { name: /profile/i })).toHaveAttribute(
      "href",
      "/u/auth-user-1",
    );
    expect(screen.getByRole("menuitem", { name: "Saved" })).toHaveAttribute(
      "href",
      "/saved",
    );
    expect(screen.getByRole("menuitem", { name: "Liked" })).toHaveAttribute(
      "href",
      "/liked",
    );
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("uses workspace presentation and notifies the drawer on actions", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenu presentation="workspace" onNavigateAction={navigateMock} />,
    );

    expect(
      screen.getByRole("button", { name: /open workspace account menu/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /open workspace account menu/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /profile/i }));

    expect(navigateMock).toHaveBeenCalled();
  });
});
