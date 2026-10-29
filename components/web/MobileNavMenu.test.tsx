import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

const { pathnameState, useQueryState, signOutMock, setThemeMock } = vi.hoisted(
  () => ({
    pathnameState: vi.fn(),
    useQueryState: vi.fn(),
    signOutMock: vi.fn(),
    setThemeMock: vi.fn(),
  }),
);

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: setThemeMock }),
}));

vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: unknown) => useQueryState(query, args),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: { getCurrentUser: "getCurrentUser" },
    notifications: { getUnreadCount: "getUnreadCount" },
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: signOutMock },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { AppNavigation, MobileNavMenu } from "./MobileNavMenu";
import {
  AuthoringExitProvider,
  useAuthoringExit,
} from "./AuthoringExitProvider";

const authoredBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Draft work", styles: {} }],
    },
  ],
});
const emptyBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [{ type: "paragraph", content: [] }],
});

function DirtyRegistrationBinder() {
  const { register } = useAuthoringExit();
  useEffect(
    () =>
      register({
        getSession: () => ({
          sessionKey: "draft:d1",
          mode: "draft",
          proposal: { title: "", body: authoredBody, tags: [] },
          baseline: { title: "", body: emptyBody, tags: [] },
          selectedCover: false,
          pendingUploads: 0,
          failedMedia: false,
          saving: false,
          uncertain: false,
          coverRemoved: false,
        }),
        flushRecovery: () => ({ ok: true }),
        clearRecovery: () => ({ ok: true }),
        saveDraft: async () => ({ kind: "saved" }),
        validateTarget: async () => ({ ok: true }),
        adoptTarget: () => {},
        startFresh: () => {},
        cancelUpdate: () => {},
        reconcile: async () => {},
        resumeRecovery: () => {},
      }),
    [register],
  );
  return null;
}

describe("MobileNavMenu", () => {
  beforeEach(() => {
    pathnameState.mockReturnValue("/create");
    setThemeMock.mockClear();
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount" ? 0 : undefined,
    );
  });

  it("exposes New Post, Blog, and Feed links for authenticated users", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute(
      "href",
      "/dashboard/feed",
    );
  });

  it("places New Post in Writing and Dashboard in Workspace", async () => {
    const user = userEvent.setup();
    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    const workspace = screen.getByRole("navigation", { name: "Workspace" });
    const writing = screen.getByRole("navigation", { name: "Writing" });
    expect(
      within(writing).getByRole("link", { name: "New Post" }),
    ).toHaveAttribute("href", "/create");
    expect(
      within(workspace).getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
    expect(
      within(writing).queryByRole("link", { name: "Dashboard" }),
    ).toBeNull();
  });

  it("exposes Home, Blog, Log In, and Sign Up for anonymous users", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu isAuthenticated={false} />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(screen.queryByRole("link", { name: "New Post" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Feed" })).toBeNull();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
    expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute(
      "href",
      "/auth/sign-up",
    );
  });

  it("keeps the mobile drawer expanded when the desktop rail is preferred", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("resonance:workspace-sidebar", "collapsed");

    try {
      render(<MobileNavMenu isAuthenticated />);
      await user.click(
        screen.getByRole("button", { name: "Open navigation menu" }),
      );

      expect(screen.getByText("Drafts")).not.toHaveClass("sr-only");
      expect(screen.getByRole("navigation", { name: "Writing" })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Expand sidebar" }),
      ).not.toBeInTheDocument();
    } finally {
      window.localStorage.removeItem("resonance:workspace-sidebar");
    }
  });

  it("opens an accessible drawer with every destination and account link", async () => {
    const user = userEvent.setup();
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount"
        ? 0
        : {
            userId: "auth-user-1",
            displayName: "Ada Lovelace",
            username: "ada",
            email: "ada@example.com",
            avatarUrl: null,
          },
    );

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(
      screen.getByRole("dialog", { name: "RESONANCE" }),
    ).toBeInTheDocument();
    for (const [name, href] of [
      ["New Post", "/create"],
      ["Drafts", "/dashboard/drafts"],
      ["My Posts", "/dashboard/published"],
      ["Analytics", "/dashboard/analytics"],
      ["Blog", "/blog"],
      ["Feed", "/dashboard/feed"],
      ["Saved", "/dashboard/saved"],
      ["Liked", "/dashboard/liked"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("link", { name: "Overview" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: /Notifications/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View profile for Ada Lovelace" }),
    ).toHaveAttribute("href", "/u/ada");
    expect(
      screen.queryByRole("link", { name: "Profile" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(
      screen.getByRole("button", { name: "Sign Out" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toBeVisible();
    const identity = screen.getByRole("link", {
      name: "View profile for Ada Lovelace",
    });
    const account = screen.getByRole("navigation", { name: "Account" });
    const themes = screen.getByRole("group", { name: "Theme" });
    const workspace = screen.getByRole("navigation", { name: "Workspace" });
    const reading = screen.getByRole("navigation", { name: "Reading" });
    const signOut = screen.getByRole("button", { name: "Sign Out" });
    expect(
      identity.compareDocumentPosition(account) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      account.compareDocumentPosition(themes) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      themes.compareDocumentPosition(workspace) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      reading.compareDocumentPosition(signOut) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("does not query or duplicate notifications in the mobile drawer", async () => {
    const user = userEvent.setup();
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount"
        ? 3
        : {
            userId: "auth-user-1",
            displayName: "Ada Lovelace",
            username: "ada",
            email: "ada@example.com",
            avatarUrl: null,
          },
    );

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(screen.queryByText("3 unread")).not.toBeInTheDocument();
    expect(useQueryState).toHaveBeenCalledWith("getUnreadCount", "skip");
  });

  it("links the identity row to profile setup when there is no username", async () => {
    const user = userEvent.setup();
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount"
        ? 0
        : {
            userId: "auth-user-1",
            displayName: "Ada Lovelace",
            username: null,
            email: "ada@example.com",
            avatarUrl: null,
          },
    );

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    expect(
      screen.getByRole("link", { name: "Set up your profile" }),
    ).toHaveAttribute("href", "/profile/edit");
  });

  it("keeps the drawer open when changing theme", async () => {
    const user = userEvent.setup();
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount"
        ? 0
        : {
            userId: "auth-user-1",
            displayName: "Ada Lovelace",
            username: "ada",
            email: "ada@example.com",
            avatarUrl: null,
          },
    );

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    const drawer = screen.getByRole("dialog", { name: "RESONANCE" });
    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(setThemeMock).toHaveBeenCalledWith("dark");
    expect(drawer).toHaveAttribute("data-state", "open");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes after selecting a workspace destination", async () => {
    const user = userEvent.setup();
    render(<MobileNavMenu isAuthenticated />);

    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    await user.click(screen.getByRole("link", { name: "Blog" }));

    expect(
      screen.queryByRole("dialog", { name: "RESONANCE" }),
    ).not.toBeInTheDocument();
  });

  it("closes after selecting an account destination", async () => {
    const user = userEvent.setup();
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount"
        ? 0
        : {
            userId: "auth-user-1",
            displayName: "Ada Lovelace",
            username: "ada",
            email: "ada@example.com",
            avatarUrl: null,
          },
    );

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    await user.click(
      screen.getByRole("link", { name: "View profile for Ada Lovelace" }),
    );

    expect(
      screen.queryByRole("dialog", { name: "RESONANCE" }),
    ).not.toBeInTheDocument();
  });

  it("routes drawer sign out through the exit coordinator and restores focus", async () => {
    const user = userEvent.setup();
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount"
        ? 0
        : {
            userId: "auth-user-1",
            displayName: "Ada Lovelace",
            username: "ada",
            email: "ada@example.com",
            avatarUrl: null,
          },
    );

    render(
      <AuthoringExitProvider>
        <DirtyRegistrationBinder />
        <MobileNavMenu isAuthenticated />
      </AuthoringExitProvider>,
    );

    const trigger = screen.getByRole("button", {
      name: "Open navigation menu",
    });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Sign Out" }));

    expect(
      screen.getByRole("alertdialog", { name: "Sign out?" }),
    ).toBeVisible();
    expect(signOutMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("restores focus to the clicked sign-out control when no drawer trigger owns it", async () => {
    const user = userEvent.setup();
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount"
        ? 0
        : {
            userId: "auth-user-1",
            displayName: "Ada Lovelace",
            username: "ada",
            email: "ada@example.com",
            avatarUrl: null,
          },
    );

    render(
      <AuthoringExitProvider>
        <DirtyRegistrationBinder />
        <button
          aria-label="Open navigation menu"
          hidden
          type="button"
          data-testid="hidden-nav-trigger"
        />
        <AppNavigation isAuthenticated />
      </AuthoringExitProvider>,
    );

    const signOut = screen.getByRole("button", { name: "Sign Out" });
    await user.click(signOut);
    expect(
      screen.getByRole("alertdialog", { name: "Sign out?" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(document.activeElement).toBe(signOut));
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
