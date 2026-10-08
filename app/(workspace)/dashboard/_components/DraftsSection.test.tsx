import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  authState,
  paginatedState,
  paginatedArgs,
  pushMock,
  deleteMock,
  loadMoreMock,
} = vi.hoisted(() => ({
  authState: vi.fn(),
  paginatedState: vi.fn(),
  paginatedArgs: vi.fn(),
  pushMock: vi.fn(),
  deleteMock: vi.fn(),
  loadMoreMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState(),
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    paginatedArgs(args);
    return paginatedState();
  },
  useMutation: () => deleteMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    posts: {
      getDrafts: "getDrafts",
      deleteDraft: "deleteDraft",
    },
  },
}));

import { DraftsSection } from "./DraftsSection";

describe("DraftsSection", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    paginatedArgs.mockReset();
    pushMock.mockReset();
    deleteMock.mockReset().mockResolvedValue(undefined);
    loadMoreMock.mockReset();
  });

  it("announces draft loading status", () => {
    paginatedState.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
      isLoading: true,
    });

    render(<DraftsSection />);

    expect(
      screen.getByRole("status", { name: "Loading drafts" }),
    ).toBeInTheDocument();
  });

  it("offers to create a post when there are no drafts", () => {
    render(<DraftsSection />);

    expect(screen.getByText("No drafts yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(paginatedArgs).toHaveBeenCalledWith({});
  });

  const draft = {
    _id: "draft-1",
    title: "My draft",
    updatedAt: 1,
    excerpt: "Hidden excerpt",
    tags: [],
    imageUrl: null,
  };
  it("explains that deleting a pending update keeps the published post live", async () => {
    const user = userEvent.setup();
    paginatedState.mockReturnValue({
      results: [{ ...draft, sourcePostId: "post-1" }],
      status: "Exhausted",
      isLoading: false,
      loadMore: loadMoreMock,
    });
    render(<DraftsSection />);
    await user.click(screen.getByRole("button", { name: "Delete My draft" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "published post stays unchanged",
    );
    await user.click(screen.getByRole("button", { name: "Delete Draft" }));
    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith({ draftId: "draft-1" }),
    );
  });
  function showDrafts(
    results = [draft],
    status = "Exhausted",
    isLoading = false,
  ) {
    paginatedState.mockReturnValue({
      results,
      status,
      isLoading,
      loadMore: loadMoreMock,
    });
  }

  it.each([
    { isAuthenticated: false, isLoading: true },
    { isAuthenticated: true, isLoading: true },
    { isAuthenticated: false, isLoading: false },
  ])(
    "skips the private list while authentication is unavailable: %j",
    (auth) => {
      authState.mockReturnValue(auth);
      render(<DraftsSection />);
      expect(paginatedArgs).toHaveBeenCalledWith("skip");
    },
  );

  it("requests twelve more drafts and preserves rows while the next page loads", async () => {
    showDrafts([draft], "CanLoadMore");
    const user = userEvent.setup();
    const view = render(<DraftsSection />);
    expect(screen.queryByText("Hidden excerpt")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(loadMoreMock).toHaveBeenCalledExactlyOnceWith(12);
    showDrafts([draft], "LoadingMore", true);
    view.rerender(<DraftsSection />);
    expect(
      screen.getByRole("link", { name: "Resume My draft" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Loading more..." }),
    ).toBeDisabled();
    showDrafts([draft, { ...draft, _id: "draft-2", title: "Next draft" }]);
    view.rerender(<DraftsSection />);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it.each(["Cancel", "Escape"])(
    "cancels confirmation with %s and restores the trigger without deleting",
    async (method) => {
      showDrafts();
      const user = userEvent.setup();
      render(<DraftsSection />);
      const trigger = screen.getByRole("button", { name: "Delete My draft" });
      await user.click(trigger);
      const dialog = screen.getByRole("alertdialog", { name: "Delete draft?" });
      expect(dialog).toHaveAccessibleDescription(/My draft.*cannot be undone/i);
      expect(
        within(dialog).getByRole("button", { name: "Cancel" }),
      ).toHaveFocus();
      if (method === "Cancel")
        await user.click(
          within(dialog).getByRole("button", { name: "Cancel" }),
        );
      else await user.keyboard("{Escape}");
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(deleteMock).not.toHaveBeenCalled();
    },
  );

  it("blocks duplicate submissions and cancellation during deletion", async () => {
    showDrafts();
    let resolve!: () => void;
    deleteMock.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const user = userEvent.setup();
    render(<DraftsSection />);
    await user.click(screen.getByRole("button", { name: "Delete My draft" }));
    await user.click(screen.getByRole("button", { name: "Delete Draft" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    const confirm = screen.getByRole("button", { name: "Deleting…" });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith({ draftId: "draft-1" });
    await act(async () => resolve());
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("keeps a failed deletion recoverable for retry", async () => {
    showDrafts();
    deleteMock.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    render(<DraftsSection />);
    await user.click(screen.getByRole("button", { name: "Delete My draft" }));
    await user.click(screen.getByRole("button", { name: "Delete Draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
    await user.click(screen.getByRole("button", { name: "Delete Draft" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(deleteMock).toHaveBeenCalledTimes(2);
  });

  it.each(["before", "after"])(
    "restores neighboring Resume focus when the list updates %s deletion resolves",
    async (timing) => {
      const next = { ...draft, _id: "draft-2", title: "Next draft" };
      showDrafts([draft, next]);
      let resolve!: () => void;
      deleteMock.mockReturnValue(
        new Promise<void>((done) => {
          resolve = done;
        }),
      );
      const user = userEvent.setup();
      const view = render(<DraftsSection />);
      await user.click(screen.getByRole("button", { name: "Delete My draft" }));
      await user.click(screen.getByRole("button", { name: "Delete Draft" }));
      if (timing === "before") {
        showDrafts([next]);
        view.rerender(<DraftsSection />);
      }
      await act(async () => resolve());
      await waitFor(() =>
        expect(
          screen.getByRole("link", { name: "Resume Next draft" }),
        ).toHaveFocus(),
      );
      showDrafts([next]);
      view.rerender(<DraftsSection />);
      expect(
        screen.getByRole("link", { name: "Resume Next draft" }),
      ).toHaveFocus();
    },
  );

  it.each(["before", "after"])(
    "focuses Create a post when the last row disappears %s deletion resolves",
    async (timing) => {
      showDrafts();
      let resolve!: () => void;
      deleteMock.mockReturnValue(
        new Promise<void>((done) => {
          resolve = done;
        }),
      );
      const user = userEvent.setup();
      const view = render(<DraftsSection />);
      await user.click(screen.getByRole("button", { name: "Delete My draft" }));
      await user.click(screen.getByRole("button", { name: "Delete Draft" }));
      if (timing === "before") {
        showDrafts([]);
        view.rerender(<DraftsSection />);
      }
      await act(async () => resolve());
      showDrafts([]);
      view.rerender(<DraftsSection />);
      await waitFor(() =>
        expect(
          screen.getByRole("link", { name: "Create a post" }),
        ).toHaveFocus(),
      );
    },
  );
});
