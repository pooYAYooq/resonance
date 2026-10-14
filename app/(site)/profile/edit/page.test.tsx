/**
 * Route tests for the Edit Profile page.
 *
 * Verifies auth gating, private-query skipping, resolved-null recovery, and
 * that the page wires `getEditorProfile` into the conflict-aware identity form
 * without navigating away on save.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsRoute from "./page";

const {
  pushMock,
  toastSuccessMock,
  toastErrorMock,
  updateIdentityMock,
  updateSelectionMock,
  loadMoreMock,
  useConvexAuthState,
  queryArgsMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  updateIdentityMock: vi.fn(),
  updateSelectionMock: vi.fn(),
  loadMoreMock: vi.fn(),
  useConvexAuthState: vi.fn(),
  queryArgsMock: vi.fn(),
}));

let currentQueryValue: unknown = undefined;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthState(),
  useQuery: (query: unknown, args: unknown) => {
    if (query === "getOwnSelectionAvailability") {
      if (args === "skip") return undefined;
      const ids = (args as { postIds: string[] }).postIds;
      const selectedPosts = (
        currentQueryValue as {
          selectedPosts?: Array<{ postId: string }>;
        } | null
      )?.selectedPosts;
      return (selectedPosts ?? []).filter((entry) =>
        ids.includes(entry.postId),
      );
    }
    return queryArgsMock(args);
  },
  useMutation: (mutation: unknown) =>
    mutation === "updateSelection" ? updateSelectionMock : updateIdentityMock,
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: loadMoreMock,
    isLoading: false,
  }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    profiles: {
      getEditorProfile: "getEditorProfile",
      updateIdentity: "updateIdentity",
      updateSelection: "updateSelection",
      getOwnSelectionAvailability: "getOwnSelectionAvailability",
      listOwnPublishedPosts: "listOwnPublishedPosts",
    },
  },
}));

const editorProfile = {
  userId: "auth-user-1",
  email: "ada@example.com",
  avatarUrl: "https://example.com/ada.png",
  identity: {
    displayName: "Ada Lovelace",
    bio: "Initial bio.",
    countryCode: "GB",
    socialProfiles: { instagram: "https://instagram.com/ada" },
    joinDateDisplay: "calendar",
  },
  joinedAt: Date.UTC(2020, 0, 15),
  identityRevision: 0,
  selectionRevision: 0,
  selectedPostIds: [],
  selectedPosts: [],
};

describe("EditProfileRoute", () => {
  beforeEach(() => {
    pushMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    updateIdentityMock.mockClear();
    updateSelectionMock.mockClear();
    loadMoreMock.mockClear();
    currentQueryValue = editorProfile;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    queryArgsMock.mockImplementation(() => currentQueryValue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /auth/login with returnTo when not authenticated", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    window.history.replaceState({}, "", "/profile/edit?section=profile#bio");
    render(<SettingsRoute />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fprofile%2Fedit%3Fsection%3Dprofile%23bio",
      );
    });
  });

  it("does not redirect while auth is loading and skips the private query", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    render(<SettingsRoute />);

    expect(pushMock).not.toHaveBeenCalled();
    expect(queryArgsMock).toHaveBeenLastCalledWith("skip");
  });

  it("skips the private editor query when anonymous", () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<SettingsRoute />);

    expect(queryArgsMock).toHaveBeenLastCalledWith("skip");
  });

  it("renders the identity form from the editor profile", () => {
    render(<SettingsRoute />);

    expect(queryArgsMock).toHaveBeenLastCalledWith({});
    expect(screen.getByLabelText(/display name/i)).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText(/bio/i)).toHaveValue("Initial bio.");
    expect(screen.getByLabelText("Country")).toHaveTextContent(
      "United Kingdom",
    );
    expect(screen.getByRole("textbox", { name: "Instagram" })).toBeVisible();
  });

  it("offers a link to the author's public page", () => {
    render(<SettingsRoute />);

    expect(
      screen.getByRole("link", { name: /back to profile/i }),
    ).toHaveAttribute("href", "/u/auth-user-1");
  });

  it("shows recovery when the authenticated user has no profile record", () => {
    currentQueryValue = null;
    render(<SettingsRoute />);

    expect(
      screen.getByText(/could not find your profile/i),
    ).toBeInTheDocument();
  });

  it("resets the form when the authenticated account changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SettingsRoute />);

    await user.type(screen.getByLabelText(/display name/i), " dirty");
    expect(screen.getByLabelText(/display name/i)).toHaveValue(
      "Ada Lovelace dirty",
    );

    currentQueryValue = {
      ...editorProfile,
      userId: "auth-user-2",
      identity: { ...editorProfile.identity, displayName: "Grace Hopper" },
    };
    rerender(<SettingsRoute />);

    expect(screen.getByLabelText(/display name/i)).toHaveValue("Grace Hopper");
  });

  it("mounts the selected-work editor from the editor profile", () => {
    render(<SettingsRoute />);

    expect(screen.getByText(/0 of 9 selected/i)).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.queryByRole("button", { name: /save profile details/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save selected work/i }),
    ).not.toBeInTheDocument();
  });

  it("saves changed profile details and selected work from the header button", async () => {
    const user = userEvent.setup();
    updateIdentityMock.mockResolvedValue({ kind: "saved", revision: 1 });
    updateSelectionMock.mockResolvedValue({ kind: "saved", revision: 1 });
    currentQueryValue = {
      ...editorProfile,
      selectedPostIds: ["posts_alpha"],
      selectedPosts: [
        { postId: "posts_alpha", title: "Alpha", imageUrl: null, likeCount: 0 },
      ],
    };
    render(<SettingsRoute />);

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toHaveAttribute("aria-disabled", "true");

    await user.type(screen.getByLabelText(/display name/i), "!");
    await user.click(screen.getByRole("button", { name: /remove alpha/i }));
    expect(saveButton).toBeEnabled();
    expect(saveButton.closest("header")).not.toBeNull();

    await user.click(saveButton);

    await waitFor(() => {
      expect(updateIdentityMock).toHaveBeenCalledWith({
        expectedRevision: 0,
        identity: {
          displayName: "Ada Lovelace!",
          bio: "Initial bio.",
          countryCode: "GB",
          socialProfiles: { instagram: "https://instagram.com/ada" },
          joinDateDisplay: "calendar",
        },
      });
      expect(updateSelectionMock).toHaveBeenCalledWith({
        expectedRevision: 0,
        postIds: [],
      });
    });

    await waitFor(() =>
      expect(saveButton).toHaveAttribute("aria-disabled", "true"),
    );
  });

  it("keeps selected work intact when an identity save fails", async () => {
    const user = userEvent.setup();
    currentQueryValue = {
      ...editorProfile,
      selectedPostIds: ["posts_alpha"],
      selectedPosts: [
        { postId: "posts_alpha", title: "Alpha", imageUrl: null, likeCount: 0 },
      ],
    };
    updateIdentityMock.mockRejectedValue(new Error("Boom"));
    render(<SettingsRoute />);

    await user.type(screen.getByLabelText(/display name/i), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.getByText(/failed to save your profile/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /remove alpha/i }),
    ).toBeInTheDocument();
    expect(updateSelectionMock).not.toHaveBeenCalled();
  });

  it("ignores a late identity save response after the account switches", async () => {
    const user = userEvent.setup();
    let resolveSave: (value: {
      kind: "saved";
      revision: number;
    }) => void = () => {};
    updateIdentityMock.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );
    const { rerender } = render(<SettingsRoute />);

    await user.type(screen.getByLabelText(/bio/i), " dirty");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateIdentityMock).toHaveBeenCalledTimes(1);

    currentQueryValue = {
      ...editorProfile,
      userId: "auth-user-2",
      identity: { ...editorProfile.identity, displayName: "Grace Hopper" },
    };
    rerender(<SettingsRoute />);

    await act(async () => {
      resolveSave({ kind: "saved", revision: 1 });
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toHaveValue(
        "Grace Hopper",
      );
    });
  });

  it("does not focus the new account's field after a previous account's save rejects", async () => {
    const user = userEvent.setup();
    let rejectSave!: (error: unknown) => void;
    updateIdentityMock.mockImplementation(
      () => new Promise((_, reject) => (rejectSave = reject)),
    );
    const { rerender } = render(<SettingsRoute />);
    await user.type(screen.getByLabelText("Bio"), " dirty");
    await user.click(screen.getByRole("button", { name: "Save" }));
    currentQueryValue = { ...editorProfile, userId: "auth-user-2" };
    rerender(<SettingsRoute />);
    screen.getByLabelText("Username").focus();
    await act(async () =>
      rejectSave({ data: { field: "bio", message: "Rejected old save" } }),
    );
    expect(screen.getByLabelText("Username")).toHaveFocus();
  });

  it("does not navigate away after a successful identity save", async () => {
    const user = userEvent.setup();
    updateIdentityMock.mockResolvedValue({ kind: "saved", revision: 1 });
    render(<SettingsRoute />);

    await user.type(screen.getByLabelText(/bio/i), " dirty");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Profile updated");
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("keeps keyboard Save focus through pending and successful submission", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: { kind: "saved"; revision: number }) => void;
    updateIdentityMock.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );
    render(<SettingsRoute />);
    await user.type(screen.getByLabelText(/bio/i), " changed");
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    await user.keyboard("{Enter}");
    expect(save).toHaveFocus();
    expect(save).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter} ");
    expect(updateIdentityMock).toHaveBeenCalledTimes(1);
    await act(async () => resolveSave({ kind: "saved", revision: 1 }));
    expect(save).toHaveFocus();
    expect(save).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    expect(updateIdentityMock).toHaveBeenCalledTimes(1);
  });
});
