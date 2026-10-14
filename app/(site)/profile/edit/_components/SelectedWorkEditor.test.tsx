import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  SelectedWorkEditor,
  type SelectedWorkCard,
} from "./SelectedWorkEditor";

const {
  updateSelectionMock,
  loadMoreMock,
  usePaginatedQueryMock,
  useQueryMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  updateSelectionMock: vi.fn(),
  loadMoreMock: vi.fn(),
  usePaginatedQueryMock: vi.fn(),
  useQueryMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => updateSelectionMock,
  usePaginatedQuery: (...args: unknown[]) => usePaginatedQueryMock(...args),
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    profiles: {
      listOwnPublishedPosts: "listOwnPublishedPosts",
      getOwnSelectionAvailability: "getOwnSelectionAvailability",
      updateSelection: "updateSelection",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const alphaId = "posts_alpha" as Id<"posts">;
const betaId = "posts_beta" as Id<"posts">;

function card(postId: Id<"posts">, title: string): SelectedWorkCard {
  return { postId, title, imageUrl: null, likeCount: 0 };
}

const alpha = card(alphaId, "Alpha");
const beta = card(betaId, "Beta");

let pickerResults: SelectedWorkCard[] = [];
let pickerStatus = "Exhausted";
let availabilityCards: Record<string, SelectedWorkCard> = {};
let deletedIds = new Set<string>();

type EditorProps = {
  selectedPostIds?: Id<"posts">[];
  selectedPosts?: SelectedWorkCard[];
  selectionRevision?: number;
};

function SelectedWorkHarness(props: EditorProps) {
  const [saveRequest, setSaveRequest] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => setSaveRequest((request) => request + 1)}
      >
        Save selected work
      </button>
      <SelectedWorkEditor
        selectedPostIds={props.selectedPostIds ?? []}
        selectedPosts={props.selectedPosts ?? []}
        selectionRevision={props.selectionRevision ?? 0}
        saveRequest={saveRequest}
        onSaveStateChange={() => {}}
      />
    </>
  );
}

function renderEditor(props: EditorProps = {}) {
  return render(<SelectedWorkHarness {...props} />);
}

describe("SelectedWorkEditor", () => {
  it("uses fresh card details when a removed post is selected again after searching", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha];
    const { rerender } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    await user.click(screen.getByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: "Remove Alpha" }));
    pickerResults = [beta];
    rerender(<SelectedWorkHarness />);
    pickerResults = [
      {
        ...alpha,
        title: "Updated Alpha",
        imageUrl: "https://example.com/updated.png",
      },
    ];
    rerender(<SelectedWorkHarness />);
    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    await user.click(screen.getByRole("button", { name: "Updated Alpha" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    const row = screen
      .getByRole("button", { name: "Remove Updated Alpha" })
      .closest("li")!;
    expect(row.querySelector("img")?.getAttribute("src")).toContain(
      "updated.png",
    );
  });
  it("preserves a newer reverted order when a save query echoes before its response", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: { kind: "saved"; revision: number }) => void;
    updateSelectionMock.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );
    const { rerender } = renderEditor({
      selectedPostIds: [alphaId, betaId],
      selectedPosts: [alpha, beta],
    });
    await user.click(screen.getByRole("button", { name: "Move Beta up" }));
    await user.click(
      screen.getByRole("button", { name: "Save selected work" }),
    );
    await user.click(screen.getByRole("button", { name: "Move Alpha up" }));
    rerender(
      <SelectedWorkHarness
        selectedPostIds={[betaId, alphaId]}
        selectedPosts={[beta, alpha]}
        selectionRevision={1}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: /^Remove / })[0],
    ).toHaveAccessibleName("Remove Alpha");
    await act(async () => resolveSave({ kind: "saved", revision: 1 }));
    expect(
      screen.getAllByRole("button", { name: /^Remove / })[0],
    ).toHaveAccessibleName("Remove Alpha");
  });
  it("opens the empty picker and returns focus to its trigger when done", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    expect(screen.getByRole("textbox", { name: "Search posts" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("textbox", { name: "Search posts" })).toBeNull();
    expect(screen.getByRole("button", { name: "Choose posts" })).toHaveFocus();
  });
  it("keeps unsaved selections when the post picker is closed and reopened", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha];
    renderEditor();
    expect(
      screen.queryByRole("textbox", { name: /search/i }),
    ).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", {
      name: /^(Choose|Add|Manage) posts$/,
    });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("button", { name: "Remove Alpha" })).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: /search/i }),
    ).not.toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(updateSelectionMock).not.toHaveBeenCalled();
  });

  it("shows the selected cover alongside a wrapping title above the actions", () => {
    const selected = { ...alpha, imageUrl: "https://example.com/selected.png" };
    renderEditor({ selectedPostIds: [alphaId], selectedPosts: [selected] });
    const row = screen
      .getByRole("button", { name: "Remove Alpha" })
      .closest("li")!;
    expect(row.querySelector("img")).toHaveAttribute("alt", "");
    expect(row.querySelector("img")?.getAttribute("src")).toContain(
      "selected.png",
    );
    expect(screen.getByText("1. Alpha")).toHaveClass("break-words");
  });
  it("shows long titles without truncation or tooltips", async () => {
    const longTitle =
      "V1-05 - Paste hardening for rejected pasted content and long authored post titles";
    const user = userEvent.setup();
    pickerResults = [card(alphaId, longTitle)];
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    const post = screen.getByRole("button", { name: longTitle });
    const title = screen.getByText(longTitle);
    expect(title).toHaveClass("whitespace-normal", "break-words");
    expect(post).not.toHaveAttribute("title");
    post.focus();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps the picker results scrollable between its fixed controls", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha];
    renderEditor({ selectedPostIds: [alphaId], selectedPosts: [alpha] });
    fireEvent.click(
      screen.getByRole("button", { name: /^(Choose|Add|Manage) posts$/ }),
    );
    const dialog = screen.getByRole("dialog");
    const results = screen.getByRole("region", {
      name: "Published post picker",
    });
    expect(dialog).toHaveClass("h-[85dvh]", "overflow-hidden");
    expect(results).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");

    await user.click(screen.getByRole("button", { name: "Done" }));
    const title = screen.getByText("1. Alpha");
    expect(title).toHaveClass("break-words");
    expect(title.closest("li")).toHaveClass("flex-col");
    expect(
      screen.getByRole("button", { name: /move alpha up/i }).parentElement,
    ).not.toBe(title.parentElement);
  });

  it("moves keyboard focus between search and available posts with arrow keys", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha, beta];
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    const search = screen.getByRole("textbox", { name: "Search posts" });
    const alphaButton = screen.getByRole("button", { name: "Alpha" });
    const betaButton = screen.getByRole("button", { name: "Beta" });

    search.focus();
    await user.keyboard("{ArrowDown}");
    expect(alphaButton).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(betaButton).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(alphaButton).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(search).toHaveFocus();
  });
  it("shows a decorative cover thumbnail beside each picker title", () => {
    pickerResults = [{ ...alpha, imageUrl: "https://example.com/alpha.png" }];
    renderEditor();
    fireEvent.click(
      screen.getByRole("button", { name: /^(Choose|Add|Manage) posts$/ }),
    );
    const thumbnail = screen
      .getByRole("button", { name: "Alpha" })
      .querySelector("img");
    expect(thumbnail).toHaveAttribute("alt", "");
  });
  beforeEach(() => {
    updateSelectionMock.mockReset();
    loadMoreMock.mockReset();
    usePaginatedQueryMock.mockReset();
    useQueryMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    pickerResults = [];
    pickerStatus = "Exhausted";
    availabilityCards = {};
    deletedIds = new Set();

    usePaginatedQueryMock.mockImplementation(
      (_query: unknown, args: unknown) =>
        args === "skip"
          ? {
              results: [],
              status: "LoadingFirstPage",
              loadMore: loadMoreMock,
              isLoading: true,
            }
          : {
              results: pickerResults,
              status: pickerStatus,
              loadMore: loadMoreMock,
              isLoading: pickerStatus === "LoadingMore",
            },
    );
    useQueryMock.mockImplementation((_query: unknown, args: unknown) => {
      if (args === "skip") return undefined;
      const { postIds } = args as { postIds: string[] };
      return postIds
        .filter((id) => !deletedIds.has(id))
        .map((id) => availabilityCards[id] ?? card(id as Id<"posts">, id));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("caps the selection at nine and disables further picks", () => {
    const selected = Array.from({ length: 9 }, (_, index) =>
      card(`posts_${index}` as Id<"posts">, `Post ${index}`),
    );
    pickerResults = [...selected, card("posts_tenth" as Id<"posts">, "Tenth")];
    pickerStatus = "Exhausted";

    renderEditor({
      selectedPostIds: selected.map((entry) => entry.postId),
      selectedPosts: selected,
    });

    fireEvent.click(
      screen.getByRole("button", { name: /^(Choose|Add|Manage) posts$/ }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText(/9 of 9 selected/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tenth" })).toBeDisabled();
  });

  it("selects, removes, and saves the ordered list", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha, beta];
    updateSelectionMock.mockResolvedValue({ kind: "saved", revision: 1 });

    renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: /^(Choose|Add|Manage) posts$/ }),
    );
    await user.click(screen.getByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Beta" }));
    expect(
      within(screen.getByRole("dialog")).getByText(/2 of 9 selected/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done" }));

    await user.click(screen.getByRole("button", { name: /remove alpha/i }));
    await user.click(
      screen.getByRole("button", { name: /save selected work/i }),
    );

    await waitFor(() => {
      expect(updateSelectionMock).toHaveBeenCalledWith({
        expectedRevision: 0,
        postIds: [betaId],
      });
    });
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("moves items up and down and persists the order", async () => {
    const user = userEvent.setup();
    updateSelectionMock.mockResolvedValue({ kind: "saved", revision: 3 });

    renderEditor({
      selectedPostIds: [alphaId, betaId],
      selectedPosts: [alpha, beta],
      selectionRevision: 2,
    });

    await user.click(screen.getByRole("button", { name: /move beta up/i }));
    await user.click(
      screen.getByRole("button", { name: /save selected work/i }),
    );

    await waitFor(() => {
      expect(updateSelectionMock).toHaveBeenCalledWith({
        expectedRevision: 2,
        postIds: [betaId, alphaId],
      });
    });
  });

  it("keeps keyboard focus when a moved item reaches the first position", async () => {
    const user = userEvent.setup();
    renderEditor({
      selectedPostIds: [alphaId, betaId],
      selectedPosts: [alpha, beta],
    });
    const move = screen.getByRole("button", { name: /move beta up/i });
    move.focus();
    await user.keyboard("{Enter}");
    expect(move).toHaveFocus();
    expect(move).toHaveAttribute("aria-disabled", "true");
  });

  it("moves focus to the remaining row after keyboard removal", async () => {
    const user = userEvent.setup();
    renderEditor({
      selectedPostIds: [alphaId, betaId],
      selectedPosts: [alpha, beta],
    });
    screen.getByRole("button", { name: /remove alpha/i }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /remove beta/i })).toHaveFocus();
  });

  it("returns focus to choosing posts when the last featured post is removed", async () => {
    const user = userEvent.setup();

    renderEditor({ selectedPostIds: [alphaId], selectedPosts: [alpha] });

    await user.click(screen.getByRole("button", { name: /remove alpha/i }));

    expect(screen.getByRole("button", { name: "Choose posts" })).toHaveFocus();
    expect(
      screen.queryByText("Removed from your selected work."),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/0 of 9 selected/i)).toBeInTheDocument();
  });

  it("debounces the title search before changing the picker query", () => {
    vi.useFakeTimers();
    pickerResults = [alpha];

    renderEditor();
    fireEvent.click(
      screen.getByRole("button", { name: /^(Choose|Add|Manage) posts$/ }),
    );
    const search = screen.getByRole("textbox", { name: "Search posts" });

    fireEvent.change(search, { target: { value: "alp" } });
    expect(usePaginatedQueryMock).toHaveBeenLastCalledWith(
      "listOwnPublishedPosts",
      { search: "" },
      { initialNumItems: 12 },
    );

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(usePaginatedQueryMock).toHaveBeenLastCalledWith(
      "listOwnPublishedPosts",
      { search: "alp" },
      { initialNumItems: 12 },
    );
  });

  it("removes a deleted post and flags conflict when local order is dirty", () => {
    const { rerender } = renderEditor({
      selectedPostIds: [alphaId, betaId],
      selectedPosts: [alpha, beta],
      selectionRevision: 2,
    });

    fireEvent.click(screen.getByRole("button", { name: /move beta up/i }));

    // The post was deleted server-side; availability no longer returns Alpha.
    deletedIds = new Set([alphaId]);
    pickerResults = [beta];
    rerender(
      <SelectedWorkHarness
        selectedPostIds={[betaId]}
        selectedPosts={[beta]}
        selectionRevision={3}
      />,
    );

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText(/featured posts changed elsewhere/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /load saved version/i }),
    ).toBeEnabled();
  });

  it("adopts a clean newer saved order", () => {
    const { rerender } = renderEditor({
      selectedPostIds: [alphaId, betaId],
      selectedPosts: [alpha, beta],
      selectionRevision: 2,
    });

    rerender(
      <SelectedWorkHarness
        selectedPostIds={[betaId, alphaId]}
        selectedPosts={[beta, alpha]}
        selectionRevision={3}
      />,
    );

    expect(
      screen.queryByText(/featured posts changed elsewhere/i),
    ).not.toBeInTheDocument();
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons[0]).toHaveAccessibleName(/remove beta/i);
  });

  it("keeps local ids when availability has not resolved", () => {
    useQueryMock.mockImplementation(() => undefined);

    renderEditor({
      selectedPostIds: [alphaId, betaId],
      selectedPosts: [alpha, beta],
    });

    expect(
      screen.getByRole("button", { name: /remove alpha/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove beta/i }),
    ).toBeInTheDocument();
  });

  it("keeps chosen titles cached across picker search changes", () => {
    pickerResults = [beta];

    const { rerender } = renderEditor({
      selectedPostIds: [alphaId],
      selectedPosts: [alpha],
    });

    expect(
      screen.getByRole("button", { name: /remove alpha/i }),
    ).toBeInTheDocument();

    pickerResults = [];
    rerender(
      <SelectedWorkHarness
        selectedPostIds={[alphaId]}
        selectedPosts={[alpha]}
        selectionRevision={0}
      />,
    );

    expect(
      screen.getByRole("button", { name: /remove alpha/i }),
    ).toBeInTheDocument();
  });

  it("requests another picker page without duplicate submissions", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha];
    pickerStatus = "CanLoadMore";

    renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: /^(Choose|Add|Manage) posts$/ }),
    );
    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(loadMoreMock).toHaveBeenCalledWith(12);
  });

  it("skips the picker query until the dialog is open", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(usePaginatedQueryMock).toHaveBeenLastCalledWith(
      "listOwnPublishedPosts",
      "skip",
      { initialNumItems: 12 },
    );

    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    expect(usePaginatedQueryMock).toHaveBeenLastCalledWith(
      "listOwnPublishedPosts",
      { search: "" },
      { initialNumItems: 12 },
    );

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(usePaginatedQueryMock).toHaveBeenLastCalledWith(
      "listOwnPublishedPosts",
      "skip",
      { initialNumItems: 12 },
    );
  });

  it("keeps a chosen card while the picker is closed", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha];
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    await user.click(screen.getByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("button", { name: "Remove Alpha" })).toBeVisible();
  });

  it("can load and select a later post after an empty eligible page", async () => {
    const user = userEvent.setup();
    pickerResults = [];
    pickerStatus = "CanLoadMore";
    const { rerender } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    expect(screen.queryByText(/no published posts with covers/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Load more" }));

    pickerStatus = "LoadingMore";
    rerender(<SelectedWorkHarness />);
    pickerResults = [alpha];
    pickerStatus = "Exhausted";
    rerender(<SelectedWorkHarness />);
    const post = screen.getByRole("button", { name: "Alpha" });
    expect(post).toHaveFocus();
    await user.click(post);
    expect(post).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Remove Alpha" })).toBeVisible();
  });

  it("explains cover eligibility when the exhausted browse has no results", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Choose posts" }));

    expect(
      screen.getByText(
        "No published posts with covers are available to feature.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("You have no published posts yet.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("explains cover eligibility when an exhausted title search has no results", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    await user.type(
      screen.getByRole("textbox", { name: "Search posts" }),
      "Alpha",
    );

    expect(
      await screen.findByText(
        "No published posts with covers match that title.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("No published posts match that title."),
    ).toBeNull();
    expect(
      screen.queryByText(
        "No published posts with covers are available to feature.",
      ),
    ).toBeNull();
  });

  it("retains pagination focus while loading then focuses the appended post", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha];
    pickerStatus = "CanLoadMore";
    const { rerender } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    const load = screen.getByRole("button", { name: "Load more" });
    load.focus();
    await user.keyboard("{Enter}");
    pickerStatus = "LoadingMore";
    rerender(<SelectedWorkHarness />);
    expect(load).toHaveFocus();
    expect(load).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter} ");
    expect(loadMoreMock).toHaveBeenCalledTimes(1);
    pickerResults = [alpha, beta];
    pickerStatus = "Exhausted";
    rerender(<SelectedWorkHarness />);
    expect(screen.getByRole("button", { name: "Beta" })).toHaveFocus();
  });

  it("does not steal focus after deliberately leaving pending pagination", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha];
    pickerStatus = "CanLoadMore";
    const { rerender } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Choose posts" }));
    screen.getByRole("button", { name: "Load more" }).focus();
    await user.keyboard("{Enter}");
    pickerStatus = "LoadingMore";
    rerender(<SelectedWorkHarness />);
    const done = screen.getByRole("button", { name: "Done" });
    done.focus();
    pickerResults = [alpha, beta];
    pickerStatus = "Exhausted";
    rerender(<SelectedWorkHarness />);
    expect(done).toHaveFocus();
  });

  it("removes an unsaved newly chosen post when it is deleted", async () => {
    const user = userEvent.setup();
    pickerResults = [alpha];
    const { rerender } = renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: /^(Choose|Add|Manage) posts$/ }),
    );
    await user.click(screen.getByRole("button", { name: "Alpha" }));
    expect(
      screen.getByRole("button", { name: /remove alpha/i }),
    ).toBeInTheDocument();

    deletedIds = new Set([alphaId]);
    rerender(
      <SelectedWorkHarness
        selectedPostIds={[]}
        selectedPosts={[]}
        selectionRevision={0}
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /remove alpha/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(
      screen.queryByText("Removed from your selected work."),
    ).not.toBeInTheDocument();
  });

  it("does not submit twice while a save is pending", async () => {
    const user = userEvent.setup();
    updateSelectionMock.mockImplementation(() => new Promise(() => {}));

    renderEditor({ selectedPostIds: [alphaId], selectedPosts: [alpha] });

    await user.click(screen.getByRole("button", { name: /remove alpha/i }));
    await user.click(
      screen.getByRole("button", { name: /save selected work/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /save selected work/i }),
    );

    expect(updateSelectionMock).toHaveBeenCalledTimes(1);
  });
});
