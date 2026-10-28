import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

const { pathnameState, useQueryState } = vi.hoisted(() => ({
  pathnameState: vi.fn(),
  useQueryState: vi.fn(),
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
  authClient: { signOut: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { WorkspaceSidebar } from "./WorkspaceSidebar";

const storageKey = "resonance:workspace-sidebar";

describe("WorkspaceSidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    pathnameState.mockReturnValue("/dashboard/drafts");
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("renders approved writing and reading links without an Overview link", () => {
    render(<WorkspaceSidebar />);

    for (const [name, href] of [
      ["New Post", "/create"],
      ["Drafts", "/dashboard/drafts"],
      ["My Posts", "/dashboard/published"],
      ["Analytics", "/dashboard/analytics"],
      ["Discover", "/blog"],
      ["Feed", "/dashboard/feed"],
      ["Saved", "/dashboard/saved"],
      ["Liked", "/dashboard/liked"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }

    expect(
      screen.queryByRole("link", { name: "Overview" }),
    ).not.toBeInTheDocument();
  });

  it("places creation in the writing group and keeps dashboard separate", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSidebar />);

    const checkGroups = () => {
      const workspace = screen.getByRole("navigation", { name: "Workspace" });
      const writing = screen.getByRole("navigation", { name: "Writing" });
      expect(
        within(writing).getByRole("link", { name: "New Post" }),
      ).toHaveAttribute("href", "/create");
      expect(
        within(workspace).getByRole("link", { name: "Dashboard" }),
      ).toHaveAttribute("href", "/dashboard");
      for (const name of ["Drafts", "My Posts", "Analytics"]) {
        expect(within(writing).getByRole("link", { name })).toBeInTheDocument();
      }
      expect(
        within(writing).queryByRole("link", { name: "Dashboard" }),
      ).toBeNull();
    };

    checkGroups();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    checkGroups();
  });

  it("marks the current route as active and renders account utilities", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSidebar />);

    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/dashboard/notifications",
    );
    await user.click(
      screen.getByRole("button", { name: "Open workspace account menu" }),
    );
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/u/ada",
    );
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(
      screen.getByRole("menuitem", { name: "Sign Out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Light" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Dark" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "System" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["/dashboard/feed", "Feed"],
    ["/dashboard/notifications", "Notifications"],
  ])("marks %s as the current destination", (pathname, label) => {
    pathnameState.mockReturnValue(pathname);
    render(<WorkspaceSidebar />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("starts expanded and restores both choices after remounting", async () => {
    const user = userEvent.setup();
    const firstVisit = render(<WorkspaceSidebar />);
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const navigationId = toggle.getAttribute("aria-controls");
    expect(navigationId).toBeTruthy();
    expect(document.getElementById(navigationId!)).toContainElement(
      screen.getByRole("navigation", { name: "Writing" }),
    );

    await user.click(toggle);
    expect(toggle).toHaveAccessibleName("Expand sidebar");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    expect(window.localStorage.getItem(storageKey)).toBe("collapsed");

    firstVisit.unmount();
    const returnVisit = render(<WorkspaceSidebar />);
    const expand = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");
    expect(window.localStorage.getItem(storageKey)).toBe("expanded");

    returnVisit.unmount();
    render(<WorkspaceSidebar />);
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles with the keyboard while keeping focus on the control", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSidebar />);

    await user.tab();
    expect(
      screen.getByRole("link", { name: "Resonance dashboard" }),
    ).toHaveFocus();
    await user.tab();
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveFocus();

    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveFocus();
  });

  it("keeps collapsed destinations accessible with focus and hover labels", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(storageKey, "collapsed");
    render(<WorkspaceSidebar />);

    const drafts = screen.getByRole("link", { name: "Drafts" });
    expect(drafts).toHaveAttribute("href", "/dashboard/drafts");
    expect(drafts).toHaveAttribute("aria-current", "page");
    act(() => drafts.focus());
    expect(
      await screen.findByRole("tooltip", { name: "Drafts" }),
    ).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(drafts).toHaveFocus();
    act(() => drafts.blur());

    await user.hover(screen.getByRole("link", { name: "Saved" }));
    expect(await screen.findByRole("tooltip", { name: "Saved" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Open workspace account menu" }),
    );
    expect(screen.getByRole("menuitem", { name: "Sign Out" })).toBeEnabled();
    for (const name of ["Light", "Dark", "System"]) {
      expect(screen.getByRole("menuitemradio", { name })).toBeEnabled();
    }
  });

  it("announces unread notifications and includes the count in the rail tooltip", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(storageKey, "collapsed");
    useQueryState.mockImplementation((query: unknown) =>
      query === "getUnreadCount" ? 3 : undefined,
    );
    render(<WorkspaceSidebar />);

    const notifications = screen.getByRole("link", {
      name: "Notifications 3 unread",
    });
    expect(notifications).toHaveAttribute("href", "/dashboard/notifications");
    await user.hover(notifications);
    expect(
      await screen.findByRole("tooltip", { name: "Notifications • 3 unread" }),
    ).toBeVisible();
  });

  it("defaults to expanded when the stored preference is unrecognized", () => {
    window.localStorage.setItem(storageKey, "invalid");
    render(<WorkspaceSidebar />);
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the toggle working when storage cannot be read", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    render(<WorkspaceSidebar />);

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps an in-memory choice when saving the preference fails", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(storageKey, "collapsed");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    render(<WorkspaceSidebar />);

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(window.localStorage.getItem(storageKey)).toBe("collapsed");
  });

  it("hydrates expanded server markup before restoring the browser preference", async () => {
    window.localStorage.setItem(storageKey, "collapsed");
    const container = document.createElement("div");
    container.innerHTML = renderToString(<WorkspaceSidebar />);
    expect(
      container.querySelector('[aria-label="Collapse sidebar"]'),
    ).not.toBeNull();
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const root = hydrateRoot(container, <WorkspaceSidebar />, {
      onRecoverableError,
    });

    try {
      await act(async () => {});
      expect(
        screen.getByRole("button", { name: "Expand sidebar" }),
      ).toHaveAttribute("aria-expanded", "false");
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(storageKey)).toBe("collapsed");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
