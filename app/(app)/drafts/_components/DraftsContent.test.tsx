import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  authState,
  paginatedState,
  paginatedArgs,
  deleteDraftMock,
  pushMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  authState: vi.fn(),
  paginatedState: vi.fn(),
  paginatedArgs: vi.fn(),
  deleteDraftMock: vi.fn(),
  pushMock: vi.fn(),
  toastErrorMock: vi.fn(),
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
  useMutation: () => deleteDraftMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    posts: {
      getDrafts: "getDrafts",
      deleteDraft: "deleteDraft",
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastErrorMock } }));

import { DraftsSection } from "../../dashboard/_components/DraftsSection";

describe("DraftsSection", () => {
  beforeEach(() => {
    authState.mockReturnValue({ isAuthenticated: true, isLoading: false });
    paginatedState.mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    deleteDraftMock.mockReset();
    pushMock.mockReset();
    paginatedArgs.mockReset();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects unauthenticated users and skips the draft query", async () => {
    authState.mockReturnValue({ isAuthenticated: false, isLoading: false });

    render(<DraftsSection />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/auth/login"));
    expect(paginatedArgs).toHaveBeenCalledWith("skip");
  });

  it("renders an empty state for authenticated users without drafts", () => {
    render(<DraftsSection />);

    expect(screen.getByText("No drafts yet")).toBeInTheDocument();
    expect(paginatedArgs).toHaveBeenCalledWith({});
  });

  it("renders safe draft summaries and deletes after confirmation", async () => {
    const user = userEvent.setup();
    paginatedState.mockReturnValue({
      results: [
        {
          _id: "draft-1",
          title: "A private draft",
          excerpt: "A safe excerpt",
          tags: ["Technology"],
          updatedAt: 1,
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    deleteDraftMock.mockResolvedValue(null);

    render(<DraftsSection />);

    expect(screen.getByText("A private draft")).toBeInTheDocument();
    expect(screen.getByText("A safe excerpt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute(
      "href",
      "/create?draftId=draft-1",
    );
    expect(screen.queryByText(/canonical|storage/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    expect(deleteDraftMock).toHaveBeenCalledWith({ draftId: "draft-1" });
  });

  it("does not delete when confirmation is cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const user = userEvent.setup();
    paginatedState.mockReturnValue({
      results: [
        { _id: "draft-1", title: "Draft", excerpt: "", tags: [], updatedAt: 1 },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });

    render(<DraftsSection />);
    await user.click(screen.getByRole("button", { name: "Delete draft" }));

    expect(deleteDraftMock).not.toHaveBeenCalled();
  });

  it("shows a loading state while drafts are being fetched", () => {
    paginatedState.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
      isLoading: true,
    });

    const { container } = render(<DraftsSection />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows an error toast when deletion fails", async () => {
    const user = userEvent.setup();
    paginatedState.mockReturnValue({
      results: [
        { _id: "draft-1", title: "Draft", excerpt: "", tags: [], updatedAt: 1 },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    });
    deleteDraftMock.mockRejectedValue(new Error("failed"));

    render(<DraftsSection />);
    await user.click(screen.getByRole("button", { name: "Delete draft" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete draft"));
  });
});
