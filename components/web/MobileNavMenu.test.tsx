import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

const { pathnameState, useQueryState, signOutMock } = vi.hoisted(() => ({
  pathnameState: vi.fn(),
  useQueryState: vi.fn(),
  signOutMock: vi.fn(),
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
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount" ? 0 : undefined,
    );
  });

  it("exposes New Post, Discover, and Feed links for authenticated users", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute(
      "href",
      "/feed",
    );
  });

  it("exposes Home, Discover, Log In, and Sign Up for anonymous users", async () => {
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
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute(
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

  it("opens an accessible drawer with every destination and account link", async () => {
    const user = userEvent.setup();
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount"
        ? 0
        : {
            userId: "auth-user-1",
            displayName: "Ada Lovelace",
            email: "ada@example.com",
            avatarUrl: null,
          },
    );

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Navigation" }),
    ).toBeInTheDocument();
    for (const [name, href] of [
      ["New Post", "/create"],
      ["Drafts", "/dashboard/drafts"],
      ["My Posts", "/dashboard/published"],
      ["Analytics", "/dashboard/analytics"],
      ["Discover", "/blog"],
      ["Feed", "/feed"],
      ["Saved", "/saved"],
      ["Liked", "/liked"],
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

    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/u/auth-user-1",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(
      screen.getByRole("button", { name: "Sign Out" }),
    ).toBeInTheDocument();
  });

  it("closes after selecting a workspace destination", async () => {
    const user = userEvent.setup();
    render(<MobileNavMenu isAuthenticated />);

    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    await user.click(screen.getByRole("link", { name: "Discover" }));

    expect(
      screen.queryByRole("dialog", { name: "Navigation" }),
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
            email: "ada@example.com",
            avatarUrl: null,
          },
    );

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    await user.click(screen.getByRole("link", { name: "Profile" }));

    expect(
      screen.queryByRole("dialog", { name: "Navigation" }),
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
