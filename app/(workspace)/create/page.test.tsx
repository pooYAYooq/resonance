import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render as renderUI,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BlockNoteDocument } from "@/lib/post-content";
import { saveDraftRecovery, readDraftRecovery } from "@/lib/draft-recovery";
import type { Id } from "@/convex/_generated/dataModel";
import CreateRoute from "./page";
import {
  AuthoringExitProvider,
  useAuthoringExit,
} from "@/components/web/AuthoringExitProvider";

function ExitTestControl() {
  const { request } = useAuthoringExit();
  return (
    <button
      onClick={() =>
        request({ kind: "history", key: "test-entry", href: "/blog" })
      }
    >
      Try leaving
    </button>
  );
}

function render(ui: React.ReactNode) {
  return renderUI(ui, {
    wrapper: ({ children }) => (
      <AuthoringExitProvider>
        {children}
        <ExitTestControl />
      </AuthoringExitProvider>
    ),
  });
}

const validEnvelope: BlockNoteDocument = {
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      props: {
        backgroundColor: "default",
        textColor: "default",
        textAlignment: "left",
      },
      content: [{ type: "text", text: "This is enough content for the body." }],
    },
  ],
};

const emptyDocument: BlockNoteDocument = {
  format: "blocknote@1",
  blocks: [],
};

const inlineEnvelope: BlockNoteDocument = {
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      props: {
        backgroundColor: "default",
        textColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: "This is enough content for the inline image post.",
        },
      ],
    },
    {
      type: "image",
      props: {
        source: { kind: "storage", id: "storage-inline-1" },
        name: "Inline image",
        caption: "",
        backgroundColor: "default",
        showPreview: true,
        textAlignment: "left",
      },
    },
  ],
};

const shortEnvelope: BlockNoteDocument = {
  format: "blocknote@1",
  blocks: [{ type: "paragraph", content: [{ type: "text", text: "short" }] }],
};

type MockPostBodyEditorProps = {
  onUploadActivityChange?: (delta: 1 | -1) => void;
  onChange: (value: BlockNoteDocument) => void;
  onPasteNotice?: (message: string) => void;
  onUploadSessionCreated?: (
    sessionId: string,
    storageId: string,
    objectUrl: string,
  ) => void;
  initialContent?: BlockNoteDocument;
  resolvedImageUrls?: Record<string, string | null>;
};

vi.mock("./_components/PostBodyEditor", () => ({
  default: ({
    onChange,
    onPasteNotice,
    onUploadSessionCreated,
    onUploadActivityChange,
    initialContent,
    resolvedImageUrls,
  }: MockPostBodyEditorProps) => (
    <>
      <button type="button" onClick={() => onUploadActivityChange?.(1)}>
        Begin media upload
      </button>
      <button type="button" onClick={() => onUploadActivityChange?.(-1)}>
        Finish media upload
      </button>
      {initialContent && <output>{JSON.stringify(initialContent)}</output>}
      {resolvedImageUrls && (
        <output>{JSON.stringify(resolvedImageUrls)}</output>
      )}
      <button
        type="button"
        aria-label="Edit blog content"
        onClick={() => onChange(validEnvelope)}
      >
        Edit content
      </button>
      <button
        type="button"
        aria-label="Register inline upload"
        onClick={() =>
          onUploadSessionCreated?.(
            "session-inline-1",
            "storage-inline-1",
            "blob:inline-1",
          )
        }
      >
        Register inline upload
      </button>
      <button
        type="button"
        aria-label="Register later inline upload"
        onClick={() =>
          onUploadSessionCreated?.(
            "session-inline-2",
            "storage-inline-2",
            "blob:inline-2",
          )
        }
      >
        Register later inline upload
      </button>
      <button
        type="button"
        aria-label="Edit inline content"
        onClick={() => onChange(inlineEnvelope)}
      >
        Edit inline content
      </button>
      <button
        type="button"
        aria-label="Set short blog content"
        onClick={() => onChange(shortEnvelope)}
      >
        Set short content
      </button>
      <button
        type="button"
        aria-label="Report paste notice"
        onClick={() =>
          onPasteNotice?.(
            "Removed a media item from the pasted content because its source is not supported.",
          )
        }
      >
        Report paste notice
      </button>
    </>
  ),
}));

const {
  pushMock,
  toastMock,
  toastSuccessMock,
  toastErrorMock,
  cleanupPendingUploadsMock,
  claimSessionMediaMock,
  renewSessionMediaMock,
  releaseSessionMediaMock,
  createPendingUploadMock,
  finalizePendingUploadMock,
  saveDraftMock,
  publishPostMock,
  getDraftByIdMock,
  getPublishedPostForEditingMock,
  updatePublishedPostMock,
  reserveAttemptMock,
  reconcileAttemptMock,
  convexQueryMock,
  draftIdParam,
  editPostIdParam,
  useConvexAuthState,
  viewerQueryMock,
  routerMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  createPendingUploadMock: vi.fn(),
  finalizePendingUploadMock: vi.fn(),
  cleanupPendingUploadsMock: vi.fn(),
  claimSessionMediaMock: vi.fn(),
  renewSessionMediaMock: vi.fn(),
  releaseSessionMediaMock: vi.fn(),
  saveDraftMock: vi.fn(),
  publishPostMock: vi.fn(),
  getDraftByIdMock: vi.fn(),
  getPublishedPostForEditingMock: vi.fn(),
  updatePublishedPostMock: vi.fn(),
  reserveAttemptMock: vi.fn(),
  reconcileAttemptMock: vi.fn(),
  convexQueryMock: vi.fn(),
  draftIdParam: { value: undefined as string | undefined },
  editPostIdParam: { value: undefined as string | undefined },
  useConvexAuthState: vi.fn(),
  viewerQueryMock: vi.fn(),
  routerMock: { push: vi.fn(), replace: vi.fn() },
}));

let fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/create",
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "draftId") return draftIdParam.value ?? null;
      if (key === "editPostId") return editPostIdParam.value ?? null;
      return null;
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(toastMock, {
    success: toastSuccessMock,
    error: toastErrorMock,
    dismiss: vi.fn(),
  }),
}));

vi.mock("convex/react", () => ({
  useMutation: (apiRef: unknown) => {
    if (apiRef === "createPendingUpload") return createPendingUploadMock;
    if (apiRef === "finalizePendingUpload") return finalizePendingUploadMock;
    if (apiRef === "cleanupPending") return cleanupPendingUploadsMock;
    if (apiRef === "claimSessionMedia") return claimSessionMediaMock;
    if (apiRef === "renewSessionMedia") return renewSessionMediaMock;
    if (apiRef === "releaseSessionMedia") return releaseSessionMediaMock;
    if (apiRef === "saveDraft") return saveDraftMock;
    if (apiRef === "publishPost") return publishPostMock;
    if (apiRef === "updatePublishedPost") return updatePublishedPostMock;
    if (apiRef === "reserveAttempt") return reserveAttemptMock;
    if (apiRef === "reconcileAttempt") return reconcileAttemptMock;
    return vi.fn();
  },
  useQuery: (apiRef: unknown, args: unknown) => {
    if (apiRef === "getCurrentUser") return viewerQueryMock(args);
    if (args === "skip") return undefined;
    if (apiRef === "getDraftById") return getDraftByIdMock(args);
    if (apiRef === "getPublishedPostForEditing") {
      return getPublishedPostForEditingMock(args);
    }
    return undefined;
  },
  useConvexAuth: () => useConvexAuthState(),
  useConvex: () => ({ query: convexQueryMock }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    pendingUploads: {
      createPendingUpload: "createPendingUpload",
      finalizePendingUpload: "finalizePendingUpload",
      cleanupPending: "cleanupPending",
    },
    posts: {
      saveDraft: "saveDraft",
      publishPost: "publishPost",
      getDraftById: "getDraftById",
      getPublishedPostForEditing: "getPublishedPostForEditing",
      updatePublishedPost: "updatePublishedPost",
    },
    writeAttempts: {
      reserveAttempt: "reserveAttempt",
      reconcileAttempt: "reconcileAttempt",
    },
    users: {
      getCurrentUser: "getCurrentUser",
    },
    sessionMediaClaims: {
      claim: "claimSessionMedia",
      renew: "renewSessionMedia",
      release: "releaseSessionMedia",
      getOwnedMediaUrls: "getOwnedMediaUrls",
    },
  },
}));

describe("CreateRoute", () => {
  it("keeps newer writing when an exit save completes", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: unknown) => void;
    saveDraftMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<CreateRoute />);
    const title = screen.getByRole("textbox", { name: "Post title" });
    fireEvent.change(title, { target: { value: "Submitted writing" } });
    await user.click(screen.getByRole("button", { name: "Try leaving" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));
    fireEvent.change(title, { target: { value: "Newer writing" } });
    await act(async () => {
      resolveSave({
        kind: "succeeded",
        postId: "draft-1",
        updatedAt: 2,
        status: "draft",
      });
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save & leave" }),
      ).toBeEnabled(),
    );
    expect(pushMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(title).toHaveValue("Newer writing");
  });

  it("reconciles a disconnected exit save using the original attempt and proposal", async () => {
    const user = userEvent.setup();
    saveDraftMock.mockRejectedValue(new Error("Connection lost"));
    reconcileAttemptMock.mockResolvedValue({
      kind: "succeeded",
      postId: "draft-1",
      updatedAt: 2,
      status: "draft",
    });
    render(<CreateRoute />);
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      "Attempted writing",
    );
    await user.click(screen.getByRole("button", { name: "Try leaving" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));
    await screen.findByRole("alertdialog", {
      name: "We couldn’t confirm your save",
    });
    await user.click(screen.getByRole("button", { name: "Check status" }));
    await waitFor(() =>
      expect(reconcileAttemptMock).toHaveBeenCalledWith(
        saveDraftMock.mock.calls[0]![0],
      ),
    );
    expect(reserveAttemptMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    saveDraftMock.mockResolvedValue({
      kind: "succeeded",
      postId: "draft-1",
      updatedAt: 3,
      status: "draft",
    });
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      " newer",
    );
    await user.click(screen.getByRole("button", { name: /^Save draft$/ }));
    await waitFor(() =>
      expect(reserveAttemptMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ postId: "draft-1", expectedUpdatedAt: 2 }),
      ),
    );
  });

  it("keeps an indeterminate reconciliation blocked without reserving another attempt", async () => {
    const user = userEvent.setup();
    saveDraftMock.mockRejectedValue(new Error("Connection lost"));
    reconcileAttemptMock.mockResolvedValue({
      kind: "indeterminate",
      message: "Still checking the original save",
    });
    render(<CreateRoute />);
    fireEvent.change(screen.getByRole("textbox", { name: "Post title" }), {
      target: { value: "Retained uncertain writing" },
    });
    await user.click(screen.getByRole("button", { name: "Try leaving" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));
    await screen.findByRole("alertdialog", {
      name: "We couldn’t confirm your save",
    });
    await user.click(screen.getByRole("button", { name: "Check status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Still checking the original save",
    );
    expect(
      screen.queryByRole("button", { name: "Leave" }),
    ).not.toBeInTheDocument();
    expect(reserveAttemptMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue(
      "Retained uncertain writing",
    );
    expect(screen.getByRole("button", { name: /^Save draft$/ })).toBeDisabled();
  });

  it("preserves writing and permits retry after reconciliation confirms failure", async () => {
    const user = userEvent.setup();
    saveDraftMock.mockRejectedValue(new Error("Connection lost"));
    reconcileAttemptMock.mockResolvedValue({
      kind: "failed",
      message: "The original save failed",
    });
    render(<CreateRoute />);
    fireEvent.change(screen.getByRole("textbox", { name: "Post title" }), {
      target: { value: "Retained failed writing" },
    });
    await user.click(screen.getByRole("button", { name: "Try leaving" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));
    await screen.findByRole("alertdialog", {
      name: "We couldn’t confirm your save",
    });
    await user.click(screen.getByRole("button", { name: "Check status" }));
    await screen.findByRole("alertdialog", { name: "Leave this page?" });
    expect(reserveAttemptMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue(
      "Retained failed writing",
    );
    expect(screen.getByRole("button", { name: /^Save draft$/ })).toBeEnabled();
  });

  it("waits for the actual draft save before continuing an exit", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: unknown) => void;
    saveDraftMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<CreateRoute />);
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      "Current work",
    );
    await user.click(screen.getByRole("button", { name: "Try leaving" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await act(async () => {
      resolveSave({
        kind: "succeeded",
        postId: "draft-1",
        updatedAt: 2,
        status: "draft",
      });
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/blog"));
  });

  it("keeps the editor when an exit draft save fails", async () => {
    const user = userEvent.setup();
    saveDraftMock.mockResolvedValue({
      kind: "failed",
      message: "Draft quota reached",
    });
    render(<CreateRoute />);
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      "Current work",
    );
    await user.click(screen.getByRole("button", { name: "Try leaving" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Draft quota reached",
    );
    expect(pushMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue(
      "Current work",
    );
  });

  beforeEach(() => {
    routerMock.push = pushMock;
    routerMock.replace = pushMock;
    pushMock.mockClear();
    toastMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    window.localStorage.clear();
    createPendingUploadMock.mockReset();
    finalizePendingUploadMock.mockReset();
    cleanupPendingUploadsMock.mockReset();
    claimSessionMediaMock.mockReset();
    renewSessionMediaMock.mockReset();
    releaseSessionMediaMock.mockReset();
    saveDraftMock.mockReset();
    publishPostMock.mockReset();
    getDraftByIdMock.mockReset();
    getPublishedPostForEditingMock.mockReset();
    updatePublishedPostMock.mockReset();
    reserveAttemptMock.mockReset();
    reconcileAttemptMock.mockReset();
    convexQueryMock.mockReset();
    viewerQueryMock.mockReset();
    convexQueryMock.mockResolvedValue([]);
    draftIdParam.value = undefined;
    editPostIdParam.value = undefined;
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    createPendingUploadMock.mockResolvedValue({
      sessionId: "session-cover",
      uploadUrl: "https://upload.url",
      expiresAt: 1_000,
    });
    finalizePendingUploadMock.mockResolvedValue({ accepted: true });
    claimSessionMediaMock.mockResolvedValue({
      claimId: "claim-1",
      expiresAt: 2_000,
    });
    reserveAttemptMock.mockResolvedValue({
      attemptId: "attempt-1",
      expiresAt: 2_000,
    });
    saveDraftMock.mockResolvedValue({
      postId: "draft-1",
      updatedAt: 1,
      status: "draft",
    });
    publishPostMock.mockResolvedValue({
      postId: "draft-1",
      updatedAt: 2,
      status: "published",
    });
    updatePublishedPostMock.mockResolvedValue({
      postId: "post-1",
      updatedAt: 2,
      status: "published",
    });
    getDraftByIdMock.mockReturnValue(undefined);
    getPublishedPostForEditingMock.mockReturnValue(undefined);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  async function enterReview(
    user: ReturnType<typeof userEvent.setup>,
    label:
      | "Review for publication"
      | "Review Update" = "Review for publication",
  ) {
    await user.click(screen.getByRole("button", { name: label }));
  }

  async function submitFromReview(
    user: ReturnType<typeof userEvent.setup>,
    label: "Publish" | "Update post" = "Publish",
  ) {
    await user.click(await screen.findByRole("button", { name: label }));
  }

  it("leaves authentication redirects to the workspace shell", async () => {
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    window.history.replaceState({}, "", "/create?draftId=draft-1#editor");

    render(<CreateRoute />);

    await waitFor(() => expect(pushMock).not.toHaveBeenCalled());
  });

  it("renders the new post route inside the Document Studio shell", () => {
    render(<CreateRoute />);

    expect(screen.getByTestId("document-studio")).toHaveAttribute(
      "data-editor-mode",
      "new",
    );
    expect(screen.getAllByText("Post details")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Save draft" })).toBeVisible();
  });

  it("skips the preview identity subscription during auth refresh and sign-out", () => {
    const view = render(<CreateRoute />);
    expect(viewerQueryMock).toHaveBeenLastCalledWith({});

    viewerQueryMock.mockClear();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
    });
    view.rerender(<CreateRoute />);
    expect(viewerQueryMock).toHaveBeenCalled();
    expect(viewerQueryMock.mock.calls.every(([args]) => args === "skip")).toBe(
      true,
    );

    viewerQueryMock.mockClear();
    useConvexAuthState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    view.rerender(<CreateRoute />);
    expect(viewerQueryMock).toHaveBeenCalled();
    expect(viewerQueryMock.mock.calls.every(([args]) => args === "skip")).toBe(
      true,
    );

    useConvexAuthState.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    view.rerender(<CreateRoute />);
    expect(viewerQueryMock).toHaveBeenLastCalledWith({});
  });

  it.each([
    ["first edit", Date.UTC(2026, 0, 1)],
    ["subsequent edit", Date.UTC(2026, 1, 1)],
  ])(
    "previews the pending update date for a %s without advancing on rerender",
    async (_, previousUpdatedAt) => {
      const user = userEvent.setup();
      const clock = vi
        .spyOn(Date, "now")
        .mockReturnValue(Date.UTC(2026, 9, 7, 12));
      try {
        editPostIdParam.value = "post-1";
        getPublishedPostForEditingMock.mockReturnValue({
          _id: "post-1",
          title: "Published title",
          body: JSON.stringify(validEnvelope),
          tags: [],
          imageUrl: null,
          inlineImages: [],
          publishedAt: Date.UTC(2026, 0, 1),
          updatedAt: previousUpdatedAt,
        });
        const view = render(<CreateRoute />);
        await screen.findByDisplayValue("Published title");
        await enterReview(user, "Review Update");
        const byline = within(
          await screen.findByTestId("review-surface"),
        ).getByTestId("article-byline");
        expect(byline).toHaveTextContent("Published on: January 1, 2026");
        expect(byline).toHaveTextContent("Updated on: October 7, 2026");

        clock.mockReturnValue(Date.UTC(2026, 9, 8, 12));
        view.rerender(<CreateRoute />);
        expect(byline).toHaveTextContent("Updated on: October 7, 2026");
        await user.click(
          screen.getByRole("button", { name: "Back to editing" }),
        );
        await enterReview(user, "Review Update");
        expect(
          within(await screen.findByTestId("review-surface")).getByTestId(
            "article-byline",
          ),
        ).toHaveTextContent("Updated on: October 8, 2026");
        expect(updatePublishedPostMock).not.toHaveBeenCalled();
      } finally {
        clock.mockRestore();
      }
    },
  );

  it.each([
    ["a first edit", Date.UTC(2026, 0, 1), "January 1, 2026"],
    ["a later edit", Date.UTC(2026, 1, 1), "February 1, 2026"],
  ])(
    "clamps the previewed update date past the saved edit for %s when the clock trails",
    async (_, savedUpdatedAt, expectedUpdated) => {
      const user = userEvent.setup();
      const clock = vi
        .spyOn(Date, "now")
        .mockReturnValue(Date.UTC(2025, 11, 20, 12));
      try {
        editPostIdParam.value = "post-1";
        getPublishedPostForEditingMock.mockReturnValue({
          _id: "post-1",
          title: "Published title",
          body: JSON.stringify(validEnvelope),
          tags: [],
          imageUrl: null,
          inlineImages: [],
          publishedAt: Date.UTC(2026, 0, 1),
          updatedAt: savedUpdatedAt,
        });
        render(<CreateRoute />);
        await screen.findByDisplayValue("Published title");
        await enterReview(user, "Review Update");
        const byline = within(
          await screen.findByTestId("review-surface"),
        ).getByTestId("article-byline");
        expect(byline).toHaveTextContent("Published on: January 1, 2026");
        expect(byline).toHaveTextContent(`Updated on: ${expectedUpdated}`);
      } finally {
        clock.mockRestore();
      }
    },
  );

  it("persists a dirty proposal to local storage", async () => {
    render(<CreateRoute />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );

    await waitFor(() => expect(readDraftRecovery("new:new")).not.toBeNull(), {
      timeout: 2500,
    });
  });

  it("keeps writing when Start fresh is cancelled and clears it only after confirmation", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);
    await user.type(
      await screen.findByRole("textbox", { name: "Post title" }),
      "Unsaved title",
    );
    await user.click(screen.getByRole("button", { name: "Edit blog content" }));
    saveDraftRecovery("new:new", {
      title: "Unsaved title",
      body: JSON.stringify(validEnvelope),
      tags: [],
    });
    await user.click(screen.getByRole("button", { name: "Start fresh" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue(
      "Unsaved title",
    );
    expect(readDraftRecovery("new:new")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Start fresh" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Start fresh",
      }),
    );
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue("");
    expect(screen.getByText(JSON.stringify(emptyDocument))).toBeVisible();
    window.dispatchEvent(new Event("pagehide"));
    expect(readDraftRecovery("new:new")).toBeNull();
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      "Fresh writing",
    );
    window.dispatchEvent(new Event("pagehide"));
    expect(readDraftRecovery("new:new")?.proposal.title).toBe("Fresh writing");
    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(publishPostMock).not.toHaveBeenCalled();
  });

  it("starts fresh from a saved draft without rehydrating it from stale URL parameters", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Saved draft",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    render(<CreateRoute />);
    await screen.findByDisplayValue("Saved draft");
    await user.click(screen.getByRole("button", { name: "Start fresh" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue("");
    expect(screen.getByTestId("document-studio")).toHaveAttribute(
      "data-editor-mode",
      "new",
    );
    expect(pushMock).toHaveBeenCalledWith("/create", { scroll: false });
    expect(saveDraftMock).not.toHaveBeenCalled();
  });

  it("retains writing when recovery deletion fails", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);
    await user.type(
      await screen.findByRole("textbox", { name: "Post title" }),
      "Keep this",
    );
    const remove = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    try {
      await user.click(screen.getByRole("button", { name: "Start fresh" }));
      await user.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Start fresh",
        }),
      );
      expect(screen.getByRole("alert")).toHaveTextContent("Could not clear");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue(
        "Keep this",
      );
      window.dispatchEvent(new Event("pagehide"));
      expect(readDraftRecovery("new:new")?.proposal.title).toBe("Keep this");
      expect(pushMock).not.toHaveBeenCalled();
    } finally {
      remove.mockRestore();
    }
  });

  it("cancels a published update to My Posts without saving the changes", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Published title",
      body: JSON.stringify(validEnvelope),
      tags: [],
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    render(<CreateRoute />);
    await screen.findByDisplayValue("Published title");
    expect(
      screen.queryByRole("button", { name: "Start fresh" }),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      " changed",
    );
    await user.click(screen.getByRole("button", { name: "Cancel update" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue(
      "Published title changed",
    );
    expect(pushMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel update" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Discard changes",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard/published");
    expect(updatePublishedPostMock).not.toHaveBeenCalled();
    expect(saveDraftMock).not.toHaveBeenCalled();
  });

  it("confirms Cancel update when the only change is a removed cover", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Published title",
      body: JSON.stringify(validEnvelope),
      tags: [],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/image.png",
      inlineImages: [],
      updatedAt: 1,
    });
    render(<CreateRoute />);
    await screen.findByDisplayValue("Published title");
    // The loaded revision is clean, so the dialog below can only be caused by
    // the removed cover.
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Remove cover" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Remove cover" })).toBeNull(),
    );
    await user.click(screen.getByRole("button", { name: "Cancel update" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(pushMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel update" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Discard changes",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard/published");
  });

  it("confirms Start fresh when the only change is a removed cover", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Covered draft",
      body: JSON.stringify(validEnvelope),
      tags: [],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/image.png",
      inlineImages: [],
      updatedAt: 1,
    });
    render(<CreateRoute />);
    await screen.findByDisplayValue("Covered draft");
    // The loaded revision is clean, so the dialog below can only be caused by
    // the removed cover.
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Remove cover" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Remove cover" })).toBeNull(),
    );
    await user.click(screen.getByRole("button", { name: "Start fresh" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByDisplayValue("Covered draft")).toBeInTheDocument();
  });

  it("cleans canceled temporary uploads in one protected request before leaving a published edit", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Published title",
      body: JSON.stringify(validEnvelope),
      tags: [],
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    let resolveCleanup!: () => void;
    cleanupPendingUploadsMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCleanup = resolve;
        }),
    );
    render(<CreateRoute />);
    await screen.findByDisplayValue("Published title");
    await user.click(
      screen.getByRole("button", { name: "Register inline upload" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      " changed",
    );
    await user.click(screen.getByRole("button", { name: "Cancel update" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    // One mutation releases the session claims and cleans the uploads in the
    // same transaction, so there is nothing to compensate on failure.
    expect(cleanupPendingUploadsMock).toHaveBeenCalledExactlyOnceWith({
      uploads: [
        { sessionId: "session-inline-1", storageId: "storage-inline-1" },
      ],
      releaseSessionId: "published-edit:post-1",
    });
    expect(releaseSessionMediaMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Discard changes" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep editing" })).toBeDisabled();
    await act(async () => resolveCleanup());
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/dashboard/published"),
    );
  });

  it("keeps the published edit protected and retryable when the cleanup request fails", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Published title",
      body: JSON.stringify(validEnvelope),
      tags: [],
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    cleanupPendingUploadsMock.mockRejectedValueOnce(new Error("offline"));
    cleanupPendingUploadsMock.mockResolvedValue(null);
    render(<CreateRoute />);
    await screen.findByDisplayValue("Published title");
    await user.click(
      screen.getByRole("button", { name: "Register inline upload" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      " changed",
    );
    await user.click(screen.getByRole("button", { name: "Cancel update" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not clean up",
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByDisplayValue("Published title changed"),
    ).toBeInTheDocument();
    // A failed transaction leaves the live claim in place: no compensating
    // claim is needed, so the only claim call is the original registration.
    expect(claimSessionMediaMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/dashboard/published"),
    );
    expect(cleanupPendingUploadsMock).toHaveBeenCalledTimes(2);
  });

  it("preserves saved pending-update uploads when discarding later temporary media", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Published title",
      body: JSON.stringify(validEnvelope),
      tags: [],
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    saveDraftMock.mockResolvedValue({
      kind: "succeeded",
      postId: "post-1",
      pendingDraftId: "pending-1",
      updatedAt: 2,
      status: "draft",
    });
    render(<CreateRoute />);
    await screen.findByDisplayValue("Published title");
    await user.click(
      screen.getByRole("button", { name: "Register inline upload" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Edit inline content" }),
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Pending update saved as draft.",
      ),
    );
    cleanupPendingUploadsMock.mockClear();
    await user.click(
      screen.getByRole("button", { name: "Register later inline upload" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      " changed",
    );
    await user.click(screen.getByRole("button", { name: "Cancel update" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/dashboard/published"),
    );
    expect(cleanupPendingUploadsMock).toHaveBeenCalledExactlyOnceWith({
      uploads: [
        { sessionId: "session-inline-2", storageId: "storage-inline-2" },
      ],
      releaseSessionId: "published-edit:post-1",
    });
  });

  it("blocks reset even when an active upload is not yet represented in the document", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);
    await user.type(
      await screen.findByRole("textbox", { name: "Post title" }),
      "Writing",
    );
    await user.click(screen.getByRole("button", { name: "Start fresh" }));
    // Exercise a background upload completing/starting while the dialog is open.
    fireEvent.click(
      screen.getByRole("button", { name: "Begin media upload", hidden: true }),
    );
    expect(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Start fresh",
      }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Start fresh" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Finish media upload" }),
    );
    expect(screen.getByRole("button", { name: "Start fresh" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue(
      "Writing",
    );
  });

  it("blocks Start fresh while a draft save is pending or uncertain", async () => {
    const user = userEvent.setup();
    let rejectSave!: (reason: Error) => void;
    saveDraftMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    render(<CreateRoute />);
    await user.type(
      await screen.findByRole("textbox", { name: "Post title" }),
      "Writing",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Start fresh" })).toBeDisabled();
    rejectSave(new Error("network outcome unknown"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Start fresh" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue(
      "Writing",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("cleans up only newly uploaded temporary media when starting fresh", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);
    await user.click(
      await screen.findByRole("button", { name: "Register inline upload" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      "Unsaved title",
    );
    await user.click(screen.getByRole("button", { name: "Start fresh" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Start fresh",
      }),
    );
    expect(cleanupPendingUploadsMock).toHaveBeenCalledWith({
      uploads: [
        { sessionId: "session-inline-1", storageId: "storage-inline-1" },
      ],
    });
    expect(screen.getByRole("textbox", { name: "Post title" })).toHaveValue("");
    expect(saveDraftMock).not.toHaveBeenCalled();
  });

  it("ignores and clears an empty recovered snapshot", async () => {
    saveDraftRecovery(
      "new:new",
      {
        title: "",
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "paragraph",
              props: {
                backgroundColor: "default",
                textColor: "default",
                textAlignment: "left",
              },
              content: [],
            },
          ],
        }),
        tags: [],
      },
      Date.now(),
    );

    render(<CreateRoute />);

    await waitFor(() => expect(readDraftRecovery("new:new")).toBeNull());
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("silently loads unsaved work found in local storage", async () => {
    saveDraftRecovery(
      "new:new",
      {
        title: "Recovered title",
        body: JSON.stringify(validEnvelope),
        tags: [],
      },
      Date.now(),
    );

    render(<CreateRoute />);

    expect(
      await screen.findByDisplayValue("Recovered title"),
    ).toBeInTheDocument();
    expect(screen.getByText(JSON.stringify(validEnvelope))).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("resolves storage media restored from a recovery snapshot", async () => {
    saveDraftRecovery(
      "new:new",
      {
        title: "Recovered media",
        body: JSON.stringify(inlineEnvelope),
        tags: [],
      },
      Date.now(),
    );
    convexQueryMock.mockResolvedValue([
      {
        storageId: "storage-inline-1",
        url: "https://cdn.example.com/recovered.png",
      },
    ]);

    render(<CreateRoute />);

    expect(
      await screen.findByDisplayValue("Recovered media"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/recovered\.png/)).toBeInTheDocument(),
    );
    expect(convexQueryMock).toHaveBeenCalledWith("getOwnedMediaUrls", {
      storageIds: ["storage-inline-1"],
    });
  });

  it("marks recovered media unavailable when the server cannot resolve it", async () => {
    saveDraftRecovery(
      "new:new",
      {
        title: "Recovered media",
        body: JSON.stringify(inlineEnvelope),
        tags: [],
      },
      Date.now(),
    );
    convexQueryMock.mockResolvedValue([
      { storageId: "storage-inline-1", url: null },
    ]);

    render(<CreateRoute />);

    expect(
      await screen.findByDisplayValue("Recovered media"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "This media is no longer available. Re-upload or remove it.",
      ),
    ).toBeInTheDocument();
  });

  it("removes an unavailable recovered media block", async () => {
    const user = userEvent.setup();
    saveDraftRecovery(
      "new:new",
      {
        title: "Recovered media",
        body: JSON.stringify(inlineEnvelope),
        tags: [],
      },
      Date.now(),
    );
    convexQueryMock.mockResolvedValue([
      { storageId: "storage-inline-1", url: null },
    ]);

    render(<CreateRoute />);
    await screen.findByDisplayValue("Recovered media");

    await user.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Remove" })).toBeNull(),
    );
    expect(releaseSessionMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({ storageIds: ["storage-inline-1"] }),
    );
  });

  it("enters Review and returns to editing with content preserved", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );

    await enterReview(user);

    const surface = await screen.findByTestId("review-surface");
    expect(surface).toHaveTextContent("Reviewable");
    expect(surface).toHaveTextContent("This is enough content for the body.");
    expect(publishPostMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Back to editing" }));

    expect(screen.queryByTestId("review-surface")).toBeNull();
    expect(screen.getByDisplayValue("Reviewable")).toBeInTheDocument();
  });

  it("keeps URL target transitions actionable without leaving Preview", async () => {
    const user = userEvent.setup();
    const view = render(<CreateRoute />);
    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Unsaved article",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await enterReview(user);
    const preview = await screen.findByTestId("review-surface");

    editPostIdParam.value = "post-next";
    getPublishedPostForEditingMock.mockReturnValue(undefined);
    view.rerender(<CreateRoute />);
    await user.click(
      await screen.findByRole("button", { name: "Load requested document" }),
    );
    expect(screen.getByText("Loading the requested document…")).toBeVisible();
    expect(preview).toHaveTextContent("Unsaved article");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(reserveAttemptMock).not.toHaveBeenCalled();

    getPublishedPostForEditingMock.mockReturnValue(null);
    view.rerender(<CreateRoute />);
    expect(
      await screen.findByText("The requested document is unavailable."),
    ).toBeVisible();
    expect(preview).toHaveTextContent("Unsaved article");

    editPostIdParam.value = "post-available";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-available",
      title: "Requested article",
      body: JSON.stringify(validEnvelope),
      tags: [],
      imageUrl: null,
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 100,
    });
    view.rerender(<CreateRoute />);
    await user.click(
      await screen.findByRole("button", { name: "Load requested document" }),
    );
    expect(
      await screen.findByDisplayValue("Requested article"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("review-surface")).toBeNull();
  });

  it("blocks Review while inline media is unresolved", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit inline content" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Review blocked until media is ready"),
      ).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: "Review for publication" }),
    );

    expect(screen.queryByTestId("review-surface")).toBeNull();
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Some media is still uploading. Wait for it to finish before publishing.",
    );
  });

  it("removes an existing cover image", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/image.png",
      inlineImages: [],
      updatedAt: 123,
    });

    render(<CreateRoute />);
    await screen.findByDisplayValue("Resumed title");

    expect(screen.getByRole("button", { name: "Remove cover" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Remove cover" })).toBeNull(),
    );
  });

  it("keeps a cover removal made while a draft save is running", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Covered draft",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/image.png",
      inlineImages: [],
      updatedAt: 1,
    });
    let resolveSave!: (value: unknown) => void;
    saveDraftMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    render(<CreateRoute />);
    await screen.findByDisplayValue("Covered draft");
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      " edited",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Remove cover" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Remove cover" })).toBeNull(),
    );

    await act(async () => {
      resolveSave({
        kind: "succeeded",
        postId: "draft-1",
        updatedAt: 2,
        status: "draft",
      });
    });
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Draft saved successfully!",
      ),
    );

    // The removal is newer than the completed save and stays unsaved: the
    // next save submits the document without the cover it just captured.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled(),
    );
    saveDraftMock.mockResolvedValue({
      kind: "succeeded",
      postId: "draft-1",
      updatedAt: 3,
      status: "draft",
    });
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(2));
    expect(reserveAttemptMock).toHaveBeenCalledTimes(2);
    expect(reserveAttemptMock.mock.calls[1]?.[0]?.proposal).not.toHaveProperty(
      "imageStorageId",
    );
  });

  it("hydrates a draft when opened with a draft ID", async () => {
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/image.png",
      inlineImages: [],
      updatedAt: 123,
    });

    render(<CreateRoute />);

    expect(
      await screen.findByDisplayValue("Resumed title"),
    ).toBeInTheDocument();
    expect(screen.getByText(JSON.stringify(validEnvelope))).toBeInTheDocument();
  });

  it("does not restore a recovery snapshot older than the server draft", async () => {
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Server newer",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      updatedAt: 500,
    });
    saveDraftRecovery(
      "draft:draft-1",
      { title: "Local stale", body: JSON.stringify(validEnvelope), tags: [] },
      100,
    );

    render(<CreateRoute />);

    expect(await screen.findByDisplayValue("Server newer")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Local stale")).toBeNull();
    expect(readDraftRecovery("draft:draft-1")).toBeNull();
  });

  it("restores a recovery snapshot newer than the server draft", async () => {
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Server older",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      updatedAt: 100,
    });
    saveDraftRecovery(
      "draft:draft-1",
      { title: "Local newer", body: JSON.stringify(validEnvelope), tags: [] },
      500,
    );

    render(<CreateRoute />);

    expect(await screen.findByDisplayValue("Local newer")).toBeInTheDocument();
  });

  it("preserves a dirty draft when reactive server data refreshes", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      updatedAt: 123,
    });

    const view = render(<CreateRoute />);
    const titleInput = await screen.findByDisplayValue("Resumed title");
    await user.clear(titleInput);
    await user.type(titleInput, "Local title");

    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Server refresh",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      updatedAt: 124,
    });
    view.rerender(<CreateRoute />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Local title")).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue("Server refresh")).toBeNull();
  });

  it("hydrates a target only once instead of replacing a clean session on refresh", async () => {
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Initial title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      updatedAt: 123,
    });

    const view = render(<CreateRoute />);
    expect(
      await screen.findByDisplayValue("Initial title"),
    ).toBeInTheDocument();

    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Reactive title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: "https://cover.example/refreshed.png",
      inlineImages: [],
      updatedAt: 124,
    });
    view.rerender(<CreateRoute />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Initial title")).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue("Reactive title")).toBeNull();
  });

  it("hydrates published editing and uses the update submit path", async () => {
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Published title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/image.png",
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 100,
    });

    render(<CreateRoute />);

    expect(
      await screen.findByDisplayValue("Published title"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review Update" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit blog content" }));
    await enterReview(user, "Review Update");
    await submitFromReview(user, "Update post");

    await waitFor(() => {
      expect(updatePublishedPostMock).toHaveBeenCalledWith(
        expect.objectContaining({ attemptId: "attempt-1" }),
      );
    });
    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(publishPostMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Post updated successfully!");
    expect(pushMock).toHaveBeenCalledWith("/dashboard/published");
  });

  it("resolves inline images when editing a published post", async () => {
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Published title",
      body: JSON.stringify(inlineEnvelope),
      tags: ["Technology"],
      imageStorageId: null,
      imageUrl: null,
      inlineImages: [
        {
          storageId: "storage-inline-1",
          url: "https://cdn.example.com/inline.png",
        },
      ],
      publishedAt: 100,
      updatedAt: 101,
    });

    render(<CreateRoute />);
    await screen.findByDisplayValue("Published title");

    expect(
      screen.getByText(
        JSON.stringify({
          "storage-inline-1": "https://cdn.example.com/inline.png",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("saves unfinished published edits as a draft without publishing or leaving the editor", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Published title",
      body: JSON.stringify(validEnvelope),
      tags: [],
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
      publishedAt: 1,
    });
    saveDraftMock.mockResolvedValue({
      kind: "succeeded",
      postId: "post-1",
      pendingDraftId: "pending-1",
      updatedAt: 2,
      status: "draft",
    });
    render(<CreateRoute />);
    await screen.findByDisplayValue("Published title");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    await user.clear(screen.getByRole("textbox", { name: "Post title" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Pending update saved as draft.",
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled(),
    );
    expect(reserveAttemptMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operationKind: "save-draft",
        postId: "post-1",
        expectedUpdatedAt: 1,
        expectedPendingDraftId: null,
        proposal: expect.objectContaining({ title: "" }),
      }),
    );
    expect(updatePublishedPostMock).not.toHaveBeenCalled();
    expect(publishPostMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Review Update" })).toBeVisible();
    await user.type(
      screen.getByRole("textbox", { name: "Post title" }),
      "Resaved pending title",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(2));
    expect(reserveAttemptMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operationKind: "save-draft",
        postId: "post-1",
        expectedUpdatedAt: 2,
        expectedPendingDraftId: "pending-1",
      }),
    );
  });

  it("disables Save Draft on a blank editor and when edits are reverted", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);
    const save = screen.getByRole("button", { name: "Save draft" });
    expect(save).toBeDisabled();
    const title = screen.getByRole("textbox", { name: "Post title" });
    await user.type(title, "Temporary edit");
    expect(save).toBeEnabled();
    await user.clear(title);
    expect(save).toBeDisabled();
    expect(reserveAttemptMock).not.toHaveBeenCalled();
  });

  it("resumes a linked draft URL in published-edit mode", async () => {
    draftIdParam.value = "pending-1";
    getDraftByIdMock.mockReturnValue({
      _id: "pending-1",
      sourcePostId: "post-1",
      title: "Pending title",
      body: JSON.stringify(validEnvelope),
      tags: [],
      imageUrl: null,
      inlineImages: [],
      updatedAt: 2,
    });
    render(<CreateRoute />);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/create?editPostId=post-1", {
        scroll: false,
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Review for publication" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("document-studio")).toHaveAttribute(
      "data-editor-mode",
      "published-edit",
    );
  });

  it("keeps the active published target when the URL changes while dirty", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Post one",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 101,
    });

    const view = render(<CreateRoute />);
    const titleInput = await screen.findByDisplayValue("Post one");
    await user.clear(titleInput);
    await user.type(titleInput, "Unsaved post one");

    editPostIdParam.value = "post-2";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-2",
      title: "Post two",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 200,
      updatedAt: 201,
    });
    view.rerender(<CreateRoute />);

    expect(screen.getByDisplayValue("Unsaved post one")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Post two")).toBeNull();

    await enterReview(user, "Review Update");
    await submitFromReview(user, "Update post");
    await waitFor(() => {
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({ postId: "post-1" }),
      );
    });
    expect(reserveAttemptMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ postId: "post-2" }),
    );
  });

  it("opens the saved published post rather than an abandoned local edit", async () => {
    editPostIdParam.value = "post-1";
    saveDraftRecovery(
      "published-edit:post-1",
      {
        title: "Abandoned edit",
        body: JSON.stringify(inlineEnvelope),
        tags: [],
      },
      Date.now(),
    );
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Saved article",
      body: JSON.stringify(inlineEnvelope),
      tags: [],
      imageUrl: null,
      inlineImages: [
        { storageId: "storage-inline-1", url: "https://example.com/saved.png" },
      ],
      publishedAt: 100,
      updatedAt: 101,
    });
    render(<CreateRoute />);
    expect(
      await screen.findByDisplayValue("Saved article"),
    ).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("Abandoned edit"),
    ).not.toBeInTheDocument();
    expect(readDraftRecovery("published-edit:post-1")).toBeNull();
    expect(screen.getByRole("img", { name: "Inline image" })).toHaveAttribute(
      "src",
      "https://example.com/saved.png",
    );
    expect(claimSessionMediaMock).not.toHaveBeenCalled();
  });

  it("loads a requested target only after explicit confirmation", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Post one",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 101,
    });

    const view = render(<CreateRoute />);
    const titleInput = await screen.findByDisplayValue("Post one");
    await user.clear(titleInput);
    await user.type(titleInput, "Unsaved post one");

    editPostIdParam.value = "post-2";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-2",
      title: "Post two",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 200,
      updatedAt: 201,
    });
    view.rerender(<CreateRoute />);

    expect(screen.getByDisplayValue("Unsaved post one")).toBeInTheDocument();
    saveDraftRecovery(
      "published-edit:post-1",
      {
        title: "Unsaved post one",
        body: JSON.stringify(validEnvelope),
        tags: ["Technology"],
      },
      Date.now(),
    );
    await user.click(
      screen.getByRole("button", { name: "Load requested document" }),
    );
    expect(await screen.findByDisplayValue("Post two")).toBeInTheDocument();
    expect(readDraftRecovery("published-edit:post-1")).toBeNull();
  });

  it("clears a pending target when navigation becomes invalid", async () => {
    const user = userEvent.setup();
    const postOne = {
      _id: "post-1",
      title: "Post one",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 101,
    };
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue(postOne);

    const view = render(<CreateRoute />);
    const titleInput = await screen.findByDisplayValue("Post one");
    await user.clear(titleInput);
    await user.type(titleInput, "Unsaved post one");

    editPostIdParam.value = "post-2";
    getPublishedPostForEditingMock.mockImplementation(
      ({ postId }: { postId: string }) =>
        postId === "post-1" ? postOne : undefined,
    );
    view.rerender(<CreateRoute />);
    await user.click(
      screen.getByRole("button", { name: "Load requested document" }),
    );
    expect(
      screen.getByText("Loading the requested document…"),
    ).toBeInTheDocument();

    draftIdParam.value = "draft-1";
    editPostIdParam.value = "post-1";
    view.rerender(<CreateRoute />);

    expect(
      await screen.findByText("This editor request is unavailable."),
    ).toBeVisible();
    expect(screen.getByDisplayValue("Unsaved post one")).toBeInTheDocument();
    expect(screen.queryByText("Loading the requested document…")).toBeNull();
  });

  it("blocks submission while a requested target is loading", async () => {
    const user = userEvent.setup();
    const postOne = {
      _id: "post-1",
      title: "Post one",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 101,
    };
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue(postOne);

    const view = render(<CreateRoute />);
    const titleInput = await screen.findByDisplayValue("Post one");
    await user.clear(titleInput);
    await user.type(titleInput, "Unsaved post one");

    editPostIdParam.value = "post-2";
    getPublishedPostForEditingMock.mockImplementation(
      ({ postId }: { postId: string }) =>
        postId === "post-1" ? postOne : undefined,
    );
    view.rerender(<CreateRoute />);
    await user.click(
      screen.getByRole("button", { name: "Load requested document" }),
    );

    const submitButton = screen.getByRole("button", {
      name: "Review Update",
    });
    expect(submitButton).toBeDisabled();
    expect(reserveAttemptMock).not.toHaveBeenCalled();
    view.unmount();
  });

  it("never shows a discard prompt when changing clean targets", async () => {
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Post one",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 101,
    });

    const view = render(<CreateRoute />);
    expect(await screen.findByDisplayValue("Post one")).toBeInTheDocument();

    let promptAppeared = false;
    const recordPrompt = (records: MutationRecord[]) => {
      promptAppeared ||= records.some((record) =>
        [...record.addedNodes].some((node) =>
          node.textContent?.includes("Load requested document"),
        ),
      );
    };
    const observer = new MutationObserver(recordPrompt);
    observer.observe(document.body, { childList: true, subtree: true });

    editPostIdParam.value = "post-2";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-2",
      title: "Post two",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 200,
      updatedAt: 201,
    });
    view.rerender(<CreateRoute />);

    expect(await screen.findByDisplayValue("Post two")).toBeInTheDocument();
    recordPrompt(observer.takeRecords());
    observer.disconnect();
    expect(promptAppeared).toBe(false);
  });

  it("can load a valid target after a confirmed target is unavailable", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    const postOne = {
      _id: "post-1",
      title: "Post one",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 101,
    };
    getPublishedPostForEditingMock.mockImplementation(
      ({ postId }: { postId: string }) =>
        postId === "post-1" ? postOne : null,
    );

    const view = render(<CreateRoute />);
    const titleInput = await screen.findByDisplayValue("Post one");
    await user.clear(titleInput);
    await user.type(titleInput, "Unsaved post one");

    editPostIdParam.value = "post-2";
    view.rerender(<CreateRoute />);
    await user.click(
      screen.getByRole("button", { name: "Load requested document" }),
    );
    expect(
      await screen.findByText("The requested document is unavailable."),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unsaved post one")).toBeInTheDocument();

    editPostIdParam.value = "post-3";
    const postThree = {
      _id: "post-3",
      title: "Post three",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 300,
      updatedAt: 301,
    };
    getPublishedPostForEditingMock.mockImplementation(
      ({ postId }: { postId: string }) =>
        postId === "post-3" ? postThree : postOne,
    );
    view.rerender(<CreateRoute />);

    await user.click(
      screen.getByRole("button", { name: "Load requested document" }),
    );
    expect(await screen.findByDisplayValue("Post three")).toBeInTheDocument();
  });

  it("treats an unuploaded cover selection as dirty session media", async () => {
    const user = userEvent.setup();
    const view = render(<CreateRoute />);
    await user.upload(
      screen.getByLabelText("Image (optional)"),
      new File(["cover"], "cover.png", { type: "image/png" }),
    );

    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Post one",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 101,
    });
    view.rerender(<CreateRoute />);

    expect(
      screen.getByRole("button", { name: "Load requested document" }),
    ).toBeInTheDocument();
  });

  it("clears a discarded cover selection so later navigation does not prompt", async () => {
    const user = userEvent.setup();
    const publishedPost = (id: string, title: string, updatedAt: number) => ({
      _id: id,
      title,
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: updatedAt - 1,
      updatedAt,
    });

    const view = render(<CreateRoute />);
    await user.upload(
      screen.getByLabelText("Image (optional)"),
      new File(["cover"], "cover.png", { type: "image/png" }),
    );

    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue(
      publishedPost("post-1", "Post one", 101),
    );
    view.rerender(<CreateRoute />);
    await user.click(
      screen.getByRole("button", { name: "Load requested document" }),
    );
    await screen.findByDisplayValue("Post one");

    editPostIdParam.value = "post-2";
    getPublishedPostForEditingMock.mockReturnValue(
      publishedPost("post-2", "Post two", 201),
    );
    view.rerender(<CreateRoute />);

    expect(await screen.findByDisplayValue("Post two")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load requested document" }),
    ).toBeNull();
  });

  it("adopts a new target after successfully saving a selected cover", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "storage-cover" }),
    });
    const view = render(<CreateRoute />);
    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Covered draft",
    );
    await user.upload(
      screen.getByLabelText("Image (optional)"),
      new File(["cover"], "cover.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));
    expect(claimSessionMediaMock).toHaveBeenCalledWith({
      sessionId: "new:new",
      storageId: "storage-cover",
    });
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Draft saved successfully!",
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled(),
    );

    editPostIdParam.value = "post-2";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-2",
      title: "Post two",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 200,
      updatedAt: 201,
    });
    await act(async () => {
      view.rerender(<CreateRoute />);
    });

    expect(await screen.findByDisplayValue("Post two")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load requested document" }),
    ).toBeNull();
  });

  it("preserves a newer cover selection made while saving", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: {
      postId: string;
      updatedAt: number;
      status: "draft";
    }) => void;
    saveDraftMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "storage-cover" }),
    });
    const view = render(<CreateRoute />);
    const imageInput =
      screen.getByLabelText<HTMLInputElement>("Image (optional)");
    const firstCover = new File(["first"], "first.png", {
      type: "image/png",
    });
    const laterCover = new File(["later"], "later.png", {
      type: "image/png",
    });

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Covered draft",
    );
    await user.upload(imageInput, firstCover);
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));

    await user.upload(imageInput, laterCover);
    resolveSave({ postId: "draft-1", updatedAt: 2, status: "draft" });

    await waitFor(() => expect(imageInput.files?.[0]?.name).toBe("later.png"));
    expect(imageInput.files?.[0]).toBe(laterCover);

    editPostIdParam.value = "post-2";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-2",
      title: "Post two",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: undefined,
      imageUrl: null,
      inlineImages: [],
      publishedAt: 200,
      updatedAt: 201,
    });
    view.rerender(<CreateRoute />);
    expect(
      await screen.findByRole("button", { name: "Load requested document" }),
    ).toBeInTheDocument();
    view.unmount();
  });

  it("clears published edit state when returning to a new post", async () => {
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Published title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/image.png",
      inlineImages: [
        {
          storageId: "storage-inline-1",
          url: "https://inline.example/image.png",
        },
      ],
      publishedAt: 100,
      updatedAt: 100,
    });

    const view = render(<CreateRoute />);
    expect(
      await screen.findByDisplayValue("Published title"),
    ).toBeInTheDocument();
    expect(screen.getByText(JSON.stringify(validEnvelope))).toBeInTheDocument();
    expect(
      screen.getByText(
        JSON.stringify({
          "storage-inline-1": "https://inline.example/image.png",
        }),
      ),
    ).toBeInTheDocument();

    editPostIdParam.value = undefined;
    view.rerender(<CreateRoute />);

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Published title")).toBeNull();
      expect(screen.queryByText(JSON.stringify(validEnvelope))).toBeNull();
      expect(
        screen.getByText(JSON.stringify(emptyDocument)),
      ).toBeInTheDocument();
      expect(screen.getByText("{}")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Technology")).not.toBeChecked();
  });

  it("renders an owner-safe recovery state for an unavailable published edit", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "missing-post";
    getPublishedPostForEditingMock.mockReturnValue(null);

    render(<CreateRoute />);

    expect(
      await screen.findByText("That published post is unavailable."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Back to My Posts" }),
    ).toBeVisible();
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Back to My Posts" }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/published");
  });

  it("renders an owner-safe recovery state for an invalid dual-target request", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    editPostIdParam.value = "post-1";

    render(<CreateRoute />);

    expect(
      await screen.findByText("This editor request is unavailable."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Back to Dashboard" }),
    ).toBeVisible();
    expect(pushMock).not.toHaveBeenCalled();
    expect(getDraftByIdMock).not.toHaveBeenCalled();
    expect(getPublishedPostForEditingMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Back to Dashboard" }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders an owner-safe recovery state for an unavailable draft", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "missing-draft";
    getDraftByIdMock.mockReturnValue(null);

    render(<CreateRoute />);

    expect(await screen.findByText("That draft is unavailable.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Back to Drafts" }),
    ).toBeVisible();
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Back to Drafts" }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/drafts");
  });

  it("shows the unavailable state for a malformed draft id on direct navigation", async () => {
    draftIdParam.value = "hand-edited corrupted draft id";
    getDraftByIdMock.mockReturnValue(null);

    render(<CreateRoute />);

    expect(await screen.findByText("That draft is unavailable.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Back to Drafts" }),
    ).toBeVisible();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed pending target without discarding the in-editor document", async () => {
    const user = userEvent.setup();
    const view = render(<CreateRoute />);
    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Unsaved article",
    );

    editPostIdParam.value = "hand-edited corrupted post id";
    getPublishedPostForEditingMock.mockReturnValue(null);
    view.rerender(<CreateRoute />);
    await user.click(
      await screen.findByRole("button", { name: "Load requested document" }),
    );

    expect(
      await screen.findByText("The requested document is unavailable."),
    ).toBeVisible();
    expect(screen.getByDisplayValue("Unsaved article")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("keeps the Review snapshot when a pending malformed target is rejected", async () => {
    const user = userEvent.setup();
    const view = render(<CreateRoute />);
    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Unsaved article",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await enterReview(user);
    const preview = await screen.findByTestId("review-surface");

    editPostIdParam.value = "hand-edited corrupted post id";
    getPublishedPostForEditingMock.mockReturnValue(null);
    view.rerender(<CreateRoute />);
    await user.click(
      await screen.findByRole("button", { name: "Load requested document" }),
    );

    expect(
      await screen.findByText("The requested document is unavailable."),
    ).toBeVisible();
    expect(preview).toHaveTextContent("Unsaved article");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("moves focus to Back to editing when entering Review and back to the Review control", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);
    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Focus transition article",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );

    await enterReview(user);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Back to editing" }),
      ).toHaveFocus(),
    );

    await user.click(screen.getByRole("button", { name: "Back to editing" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Review for publication" }),
      ).toHaveFocus(),
    );
  });

  it("shows validation error for empty title", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);

    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.upload(
      screen.getByLabelText("Image (optional)"),
      new File(["img"], "photo.png", { type: "image/png" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Review for publication" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Title is required.")).toBeInTheDocument();
    });

    expect(saveDraftMock).not.toHaveBeenCalled();
  });

  it("saves an incomplete draft without publishing", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Unfinished thought",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(saveDraftMock).toHaveBeenCalledWith({
        attemptId: "attempt-1",
        proposal: {
          title: "Unfinished thought",
          body: JSON.stringify({ format: "blocknote@1", blocks: [] }),
          tags: [],
        },
      });
    });
    expect(publishPostMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Draft saved successfully!");
  });

  it("uses the latest saved version token for a consecutive draft save", async () => {
    const user = userEvent.setup();
    reserveAttemptMock
      .mockResolvedValueOnce({ attemptId: "attempt-1", expiresAt: 2_000 })
      .mockResolvedValueOnce({ attemptId: "attempt-2", expiresAt: 3_000 });
    saveDraftMock
      .mockResolvedValueOnce({
        postId: "draft-1",
        updatedAt: 10,
        status: "draft",
      })
      .mockResolvedValueOnce({
        postId: "draft-1",
        updatedAt: 11,
        status: "draft",
      });

    render(<CreateRoute />);
    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Two saves",
    );

    const saveButton = screen.getByRole("button", { name: "Save draft" });
    await user.click(saveButton);
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));

    // A saved proposal stays disabled until there is another meaningful edit.
    await waitFor(() => expect(saveButton).toBeDisabled());
    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      " again",
    );
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(2), {
      timeout: 3_000,
    });

    expect(reserveAttemptMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        postId: "draft-1",
        expectedUpdatedAt: 10,
      }),
    );
  });

  it("does not submit when Enter is pressed in the title", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Draft{Enter}",
    );

    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(publishPostMock).not.toHaveBeenCalled();
  });

  it("keeps line breaks pasted into the title on a single line", () => {
    render(<CreateRoute />);

    fireEvent.change(screen.getByPlaceholderText("Give your post a title"), {
      target: { value: "First\nSecond" },
    });

    expect(screen.getByPlaceholderText("Give your post a title")).toHaveValue(
      "First Second",
    );
  });

  it("shows pasted-content notices immediately", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);

    await user.click(
      screen.getByRole("button", { name: "Report paste notice" }),
    );

    expect(toastMock).toHaveBeenCalledWith(
      "Removed a media item from the pasted content because its source is not supported.",
    );
  });

  it("keeps the editor mounted when publish validation fails", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "A titled post",
    );
    await user.click(
      screen.getByRole("button", { name: "Review for publication" }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Content must contain/)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Edit blog content" }),
    ).toBeInTheDocument();
    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(publishPostMock).not.toHaveBeenCalled();
  });

  it("disables submit button while pending", async () => {
    const user = userEvent.setup();

    // Hang the mutation so the pending state stays visible
    createPendingUploadMock.mockImplementation(
      () => new Promise<string>(() => {}),
    );

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "My Post",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.upload(
      screen.getByLabelText("Image (optional)"),
      new File(["img"], "photo.png", { type: "image/png" }),
    );

    await enterReview(user);
    const button = await screen.findByRole("button", { name: "Publish" });
    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    expect(screen.getByText(/publishing/i)).toBeInTheDocument();
  });

  it("submits successfully and redirects", async () => {
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "storage-123" }),
    });

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "My Post",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.upload(
      screen.getByLabelText("Image (optional)"),
      new File(["img"], "photo.png", { type: "image/png" }),
    );

    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => {
      expect(createPendingUploadMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("https://upload.url", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: expect.any(File),
      });
    });

    await waitFor(() => {
      expect(publishPostMock).toHaveBeenCalledWith(
        expect.objectContaining({ attemptId: "attempt-1" }),
      );
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Post published successfully!",
      );
      expect(pushMock).toHaveBeenCalledWith("/blog");
    });
  });

  it("shows error toast when image upload fails", async () => {
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({ ok: false });

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "My Post",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.upload(
      screen.getByLabelText("Image (optional)"),
      new File(["img"], "photo.png", { type: "image/png" }),
    );

    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to upload image");
    });

    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("creates a text-only post successfully without imageStorageId", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "My Post",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );

    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => {
      expect(publishPostMock).toHaveBeenCalledWith(
        expect.objectContaining({ attemptId: "attempt-1" }),
      );
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Post published successfully!",
      );
      expect(pushMock).toHaveBeenCalledWith("/blog");
    });

    expect(createPendingUploadMock).not.toHaveBeenCalled();
    expect(cleanupPendingUploadsMock).not.toHaveBeenCalled();
  });

  it("claims inline media and exposes its resolved object URL", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);
    await user.click(
      screen.getByRole("button", { name: "Register inline upload" }),
    );

    await waitFor(() => {
      expect(claimSessionMediaMock).toHaveBeenCalledWith({
        sessionId: "new:new",
        storageId: "storage-inline-1",
      });
    });
    expect(screen.getByText(/blob:inline-1/)).toBeInTheDocument();
  });

  it("renews active claims and releases them when the editor unmounts", async () => {
    const view = render(<CreateRoute />);
    await userEvent
      .setup()
      .click(
        await screen.findByRole("button", { name: "Register inline upload" }),
      );
    expect(claimSessionMediaMock).toHaveBeenCalled();

    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    fireEvent.focus(window);
    expect(renewSessionMediaMock).toHaveBeenCalledWith({
      sessionId: "new:new",
      storageIds: ["storage-inline-1"],
      isVisible: true,
      isActive: true,
    });
    view.unmount();
    expect(releaseSessionMediaMock).toHaveBeenCalledWith({
      sessionId: "new:new",
      storageIds: ["storage-inline-1"],
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("skips renewal while the document is not focused", async () => {
    const view = render(<CreateRoute />);
    await userEvent
      .setup()
      .click(
        await screen.findByRole("button", { name: "Register inline upload" }),
      );

    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    fireEvent.focus(window);

    expect(renewSessionMediaMock).not.toHaveBeenCalled();
    view.unmount();
    vi.restoreAllMocks();
  });

  it("cleans up only the current submit's inline sessions after a failure", async () => {
    const user = userEvent.setup();
    publishPostMock.mockResolvedValue({
      kind: "failed",
      message: "Invalid inline upload claim",
    });
    cleanupPendingUploadsMock.mockResolvedValue(null);

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "My Post",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Register inline upload" }),
    );
    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => {
      expect(cleanupPendingUploadsMock).toHaveBeenCalledWith({
        uploads: [
          { sessionId: "session-inline-1", storageId: "storage-inline-1" },
        ],
      });
    });
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to save post");
  });

  it("shows the inline expiry recovery message and preserves it when cleanup fails", async () => {
    const user = userEvent.setup();
    publishPostMock.mockResolvedValue({
      kind: "failed",
      message: "Inline image expired",
    });
    cleanupPendingUploadsMock.mockRejectedValue(new Error("cleanup failed"));

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "My Post",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Register inline upload" }),
    );
    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => {
      expect(cleanupPendingUploadsMock).toHaveBeenCalledWith({
        uploads: [
          { sessionId: "session-inline-1", storageId: "storage-inline-1" },
        ],
      });
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "An inline image expired. Re-upload it and try again.",
      );
    });
  });

  it("does not clean up an inline upload registered after submission starts", async () => {
    // The second upload is newer than the submission snapshot and must not
    // be cleaned up with the first submission's upload.
    const user = userEvent.setup();
    let resolvePublishPost: ((result: unknown) => void) | undefined;
    publishPostMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePublishPost = resolve;
        }),
    );
    cleanupPendingUploadsMock.mockResolvedValue(null);

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "My Post",
    );
    await user.click(
      screen.getByRole("button", { name: "Edit inline content" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Register inline upload" }),
    );
    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => expect(publishPostMock).toHaveBeenCalled());

    fireEvent.click(
      screen.getByRole("button", {
        name: "Register later inline upload",
        hidden: true,
      }),
    );
    resolvePublishPost?.({
      kind: "failed",
      message: "Invalid inline upload claim",
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to save post");
    });
    expect(cleanupPendingUploadsMock).toHaveBeenCalledWith({
      uploads: [
        { sessionId: "session-inline-1", storageId: "storage-inline-1" },
      ],
    });
  });

  it("rejects an empty or short structured document before upload or mutation", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "My Post",
    );
    await user.upload(
      screen.getByLabelText("Image (optional)"),
      new File(["img"], "photo.png", { type: "image/png" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Review for publication" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText((t) => t.includes("Content must contain")),
      ).toBeInTheDocument();
    });

    expect(createPendingUploadMock).not.toHaveBeenCalled();
    expect(saveDraftMock).not.toHaveBeenCalled();

    await user.click(
      await screen.findByRole("button", { name: "Set short blog content" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Review for publication" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText((t) => t.includes("Content must contain")),
      ).toBeInTheDocument();
    });

    expect(createPendingUploadMock).not.toHaveBeenCalled();
    expect(saveDraftMock).not.toHaveBeenCalled();
  });

  it("shows the Review state and hides Post details", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await enterReview(user);

    await screen.findByTestId("review-surface");
    expect(screen.getByText("Preview")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Back to editing" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish" })).toBeVisible();
    expect(screen.queryByText("Post details")).toBeNull();
  });

  it("keeps the reviewed preview and submission frozen at Review entry", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewed title",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await enterReview(user);
    await screen.findByTestId("review-surface");

    // Review replaces the editing canvas, so the reviewed values cannot
    // drift while the author stays in Review.
    expect(screen.queryByLabelText("Post title")).toBeNull();

    const surface = screen.getByTestId("review-surface");
    expect(surface).toHaveTextContent("Reviewed title");
    expect(surface).toHaveTextContent("This is enough content for the body.");
    expect(surface).not.toHaveTextContent("short");

    await submitFromReview(user);

    await waitFor(() =>
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          operationKind: "publish",
          proposal: expect.objectContaining({
            title: "Reviewed title",
            body: expect.stringContaining(
              "This is enough content for the body.",
            ),
          }),
        }),
      ),
    );
  });

  it("publishes the tags captured at Review entry", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.click(screen.getByLabelText("Technology"));
    await enterReview(user);

    expect(await screen.findByTestId("review-surface")).toHaveTextContent(
      "Technology",
    );

    await submitFromReview(user);

    await waitFor(() =>
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          proposal: expect.objectContaining({ tags: ["Technology"] }),
        }),
      ),
    );
  });

  it("uploads the cover selected before Review", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "storage-cover" }),
    });
    const cover = new File(["cover"], "cover.png", { type: "image/png" });
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.upload(screen.getByLabelText("Image (optional)"), cover);
    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() =>
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          proposal: expect.objectContaining({
            imageStorageId: "storage-cover",
          }),
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://upload.url",
      expect.objectContaining({ body: cover }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Replace cover" }),
      ).toBeNull(),
    );
  });

  it("clears a selected cover when Remove cover is clicked", async () => {
    const user = userEvent.setup();
    const cover = new File(["cover"], "cover.png", { type: "image/png" });
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.upload(screen.getByLabelText("Image (optional)"), cover);
    expect(screen.getByText("cover.png")).toBeVisible();
    expect(screen.getByText("Uploads when you save or publish")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    await waitFor(() =>
      expect(screen.getByText("No cover selected")).toBeVisible(),
    );
    expect(
      screen.getByText("Your post will show without a cover image."),
    ).toBeVisible();
    expect(screen.queryByText("cover.png")).toBeNull();
    expect(screen.queryByRole("button", { name: "Replace cover" })).toBeNull();

    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => expect(reserveAttemptMock).toHaveBeenCalled());
    const call = reserveAttemptMock.mock.calls.at(-1)?.[0] as {
      proposal: { imageStorageId?: string };
    };
    expect(call.proposal.imageStorageId).toBeUndefined();
    expect(createPendingUploadMock).not.toHaveBeenCalled();
  });

  it("surfaces a rejected cover file when entering Review", async () => {
    const user = userEvent.setup();
    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await user.upload(screen.getByLabelText("Image (optional)"), oversized);
    await enterReview(user);

    expect(
      await screen.findByText("Image must be 5MB or smaller."),
    ).toBeVisible();
    expect(screen.queryByTestId("review-surface")).toBeNull();
  });

  it("reuses an existing cover on publish", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/image.png",
      inlineImages: [],
      updatedAt: 123,
    });

    render(<CreateRoute />);
    await screen.findByDisplayValue("Resumed title");
    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() =>
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          proposal: expect.objectContaining({ imageStorageId: "cover-1" }),
        }),
      ),
    );
  });

  it("publishes without a cover after removing an existing cover", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/image.png",
      inlineImages: [],
      updatedAt: 123,
    });

    render(<CreateRoute />);
    await screen.findByDisplayValue("Resumed title");
    await user.click(screen.getByRole("button", { name: "Remove cover" }));
    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => expect(reserveAttemptMock).toHaveBeenCalled());
    const call = reserveAttemptMock.mock.calls.at(-1)?.[0] as {
      proposal: { imageStorageId?: string };
    };
    expect(call.proposal.imageStorageId).toBeUndefined();
  });

  it("keeps uploaded media reviewable when its background protection request fails", async () => {
    const user = userEvent.setup();
    let rejectClaim!: (reason?: unknown) => void;
    claimSessionMediaMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectClaim = reject;
        }),
    );
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Register inline upload" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Edit inline content" }),
    );
    await enterReview(user);
    await screen.findByTestId("review-surface");

    rejectClaim(new Error("claim failed"));

    await waitFor(() => expect(claimSessionMediaMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
    rejectClaim(new Error("still offline"));
    await user.click(screen.getByRole("button", { name: "Back to editing" }));
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(claimSessionMediaMock).toHaveBeenCalledTimes(3));
  });

  it("ignores a second publish while the first is in flight", async () => {
    const user = userEvent.setup();
    reserveAttemptMock.mockReturnValue(new Promise(() => {}));
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    await enterReview(user);

    const publish = await screen.findByRole("button", { name: "Publish" });
    await user.click(publish);
    await user.click(publish);

    expect(reserveAttemptMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the loaded cover when a dirty switch follows a cover removal", async () => {
    const user = userEvent.setup();
    editPostIdParam.value = "post-1";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-1",
      title: "Post one",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: "https://cover.example/one.png",
      inlineImages: [],
      publishedAt: 100,
      updatedAt: 101,
    });

    const view = render(<CreateRoute />);
    await screen.findByDisplayValue("Post one");
    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    editPostIdParam.value = "post-2";
    getPublishedPostForEditingMock.mockReturnValue({
      _id: "post-2",
      title: "Post two",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-2",
      imageUrl: "https://cover.example/two.png",
      inlineImages: [],
      publishedAt: 200,
      updatedAt: 201,
    });
    view.rerender(<CreateRoute />);

    await user.click(
      await screen.findByRole("button", { name: "Load requested document" }),
    );
    await screen.findByDisplayValue("Post two");

    await enterReview(user, "Review Update");
    const cover = await screen.findByAltText("Post two");
    expect(cover.getAttribute("src") ?? "").toContain(
      "cover.example%2Ftwo.png",
    );

    await submitFromReview(user, "Update post");

    await waitFor(() =>
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          operationKind: "update-post",
          proposal: expect.objectContaining({ imageStorageId: "cover-2" }),
        }),
      ),
    );
  });

  it("holds Review while a recovered cover loads, then previews and keeps it", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    saveDraftRecovery(
      "draft:draft-1",
      {
        title: "Recovered title",
        body: JSON.stringify(validEnvelope),
        tags: ["Technology"],
        imageStorageId: "cover-1" as Id<"_storage">,
      },
      Date.now(),
    );
    let resolveCover: (value: unknown) => void = () => {};
    convexQueryMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCover = resolve;
      }),
    );

    render(<CreateRoute />);
    await screen.findByDisplayValue("Recovered title");

    const hold =
      "Loading your saved cover. Review will be available when it finishes.";
    expect(screen.getByText(hold)).toBeVisible();
    expect(screen.getByText("Saved cover")).toBeVisible();

    await enterReview(user);
    expect(toastErrorMock).toHaveBeenCalledWith(hold);
    expect(screen.queryByTestId("review-surface")).toBeNull();

    resolveCover([
      { storageId: "cover-1", url: "https://cover.example/one.png" },
    ]);
    await waitFor(() => expect(screen.queryByText(hold)).toBeNull());

    await enterReview(user);
    const cover = await screen.findByAltText("Recovered title");
    expect(cover.getAttribute("src") ?? "").toContain(
      "cover.example%2Fone.png",
    );
    await submitFromReview(user);

    await waitFor(() =>
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          proposal: expect.objectContaining({ imageStorageId: "cover-1" }),
        }),
      ),
    );
  });

  it("blocks Review with an alert when a recovered cover cannot load", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    saveDraftRecovery(
      "draft:draft-1",
      {
        title: "Recovered title",
        body: JSON.stringify(validEnvelope),
        tags: ["Technology"],
        imageStorageId: "cover-1" as Id<"_storage">,
      },
      Date.now(),
    );
    convexQueryMock.mockResolvedValue([{ storageId: "cover-1", url: null }]);

    render(<CreateRoute />);
    await screen.findByDisplayValue("Recovered title");

    const cover = screen.getByRole("region", { name: "Cover" });
    const failure =
      "Your saved cover could not be loaded. Replace it or remove it to continue to Review.";
    expect(await within(cover).findByRole("alert")).toHaveTextContent(failure);

    await enterReview(user);
    expect(toastErrorMock).toHaveBeenCalledWith(failure);
    expect(screen.queryByTestId("review-surface")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Remove cover" }));
    await waitFor(() => expect(within(cover).queryByRole("alert")).toBeNull());
    expect(screen.getByText("No cover selected")).toBeVisible();
    expect(
      screen.getByText("Your post will show without a cover image."),
    ).toBeVisible();

    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => expect(reserveAttemptMock).toHaveBeenCalled());
    const call = reserveAttemptMock.mock.calls.at(-1)?.[0] as {
      proposal: { imageStorageId?: string };
    };
    expect(call.proposal.imageStorageId).toBeUndefined();
  });

  it("keeps the hold and retries a transient recovered cover lookup", async () => {
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    saveDraftRecovery(
      "draft:draft-1",
      {
        title: "Recovered title",
        body: JSON.stringify(validEnvelope),
        tags: ["Technology"],
        imageStorageId: "cover-1" as Id<"_storage">,
      },
      Date.now(),
    );
    convexQueryMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([
        { storageId: "cover-1", url: "https://cover.example/one.png" },
      ]);

    render(<CreateRoute />);
    await screen.findByDisplayValue("Recovered title");
    await waitFor(() => expect(convexQueryMock).toHaveBeenCalledTimes(1));

    const cover = screen.getByRole("region", { name: "Cover" });

    // A rejected lookup is transient: keep the hold and never show the alert.
    expect(
      screen.getByText(
        "Loading your saved cover. Review will be available when it finishes.",
      ),
    ).toBeVisible();
    expect(within(cover).queryByRole("alert")).toBeNull();

    fireEvent(window, new Event("focus"));

    const preview = await screen.findByTestId("media-preview");
    expect(preview.getAttribute("src") ?? "").toContain(
      "cover.example/one.png",
    );
    await waitFor(() =>
      expect(
        screen.queryByText(
          "Loading your saved cover. Review will be available when it finishes.",
        ),
      ).toBeNull(),
    );
    expect(within(cover).queryByRole("alert")).toBeNull();
  });

  it("shows the alert for a missing recovered cover without retrying", async () => {
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    saveDraftRecovery(
      "draft:draft-1",
      {
        title: "Recovered title",
        body: JSON.stringify(validEnvelope),
        tags: ["Technology"],
        imageStorageId: "cover-1" as Id<"_storage">,
      },
      Date.now(),
    );
    convexQueryMock.mockResolvedValue([{ storageId: "cover-1", url: null }]);

    render(<CreateRoute />);
    await screen.findByDisplayValue("Recovered title");

    const cover = screen.getByRole("region", { name: "Cover" });
    expect(await within(cover).findByRole("alert")).toHaveTextContent(
      "Your saved cover could not be loaded. Replace it or remove it to continue to Review.",
    );
    expect(convexQueryMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a late recovered cover result after the author replaces it", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    saveDraftRecovery(
      "draft:draft-1",
      {
        title: "Recovered title",
        body: JSON.stringify(validEnvelope),
        tags: ["Technology"],
        imageStorageId: "cover-1" as Id<"_storage">,
      },
      Date.now(),
    );
    let resolveCover: (value: unknown) => void = () => {};
    convexQueryMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCover = resolve;
      }),
    );
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "storage-cover" }),
    });
    const replacement = new File(["cover"], "new.png", { type: "image/png" });

    render(<CreateRoute />);
    await screen.findByDisplayValue("Recovered title");
    await user.upload(screen.getByLabelText("Image (optional)"), replacement);
    expect(
      screen.queryByText(
        "Loading your saved cover. Review will be available when it finishes.",
      ),
    ).toBeNull();

    resolveCover([
      { storageId: "cover-1", url: "https://cover.example/one.png" },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      screen.queryByText(
        "Loading your saved cover. Review will be available when it finishes.",
      ),
    ).toBeNull();

    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() =>
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          proposal: expect.objectContaining({
            imageStorageId: "storage-cover",
          }),
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://upload.url",
      expect.objectContaining({ body: replacement }),
    );
  });

  it("ignores a late recovered cover result after the author removes it", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    getDraftByIdMock.mockReturnValue({
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    });
    saveDraftRecovery(
      "draft:draft-1",
      {
        title: "Recovered title",
        body: JSON.stringify(validEnvelope),
        tags: ["Technology"],
        imageStorageId: "cover-1" as Id<"_storage">,
      },
      Date.now(),
    );
    let resolveCover: (value: unknown) => void = () => {};
    convexQueryMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCover = resolve;
      }),
    );

    render(<CreateRoute />);
    await screen.findByDisplayValue("Recovered title");
    await user.click(screen.getByRole("button", { name: "Remove cover" }));
    expect(await screen.findByText("No cover selected")).toBeVisible();
    expect(
      screen.getByText("Your post will show without a cover image."),
    ).toBeVisible();

    resolveCover([
      { storageId: "cover-1", url: "https://cover.example/one.png" },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText("No cover selected")).toBeVisible();
    expect(
      screen.getByText("Your post will show without a cover image."),
    ).toBeVisible();
    expect(screen.queryByTestId("default-cover")).toBeNull();

    await enterReview(user);
    await submitFromReview(user);

    await waitFor(() => expect(reserveAttemptMock).toHaveBeenCalled());
    const call = reserveAttemptMock.mock.calls.at(-1)?.[0] as {
      proposal: { imageStorageId?: string };
    };
    expect(call.proposal.imageStorageId).toBeUndefined();
    expect(createPendingUploadMock).not.toHaveBeenCalled();
  });

  it("ignores a late recovered cover result after the target changes", async () => {
    const user = userEvent.setup();
    draftIdParam.value = "draft-1";
    const draftOne = {
      _id: "draft-1",
      title: "Resumed title",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-1",
      imageUrl: null,
      inlineImages: [],
      updatedAt: 1,
    };
    const draftTwo = {
      _id: "draft-2",
      title: "Second draft",
      body: JSON.stringify(validEnvelope),
      tags: ["Technology"],
      imageStorageId: "cover-2",
      imageUrl: "https://cover.example/two.png",
      inlineImages: [],
      updatedAt: 2,
    };
    getDraftByIdMock.mockImplementation(({ draftId }: { draftId: string }) =>
      draftId === "draft-1" ? draftOne : draftTwo,
    );
    saveDraftRecovery(
      "draft:draft-1",
      {
        title: "Recovered title",
        body: JSON.stringify(validEnvelope),
        tags: ["Technology"],
        imageStorageId: "cover-1" as Id<"_storage">,
      },
      Date.now(),
    );
    let resolveCover: (value: unknown) => void = () => {};
    convexQueryMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCover = resolve;
      }),
    );

    const view = render(<CreateRoute />);
    await screen.findByDisplayValue("Recovered title");

    draftIdParam.value = "draft-2";
    view.rerender(<CreateRoute />);
    await user.click(
      await screen.findByRole("button", { name: "Load requested document" }),
    );
    await screen.findByDisplayValue("Second draft");
    expect(
      screen.queryByText(
        "Loading your saved cover. Review will be available when it finishes.",
      ),
    ).toBeNull();

    resolveCover([
      { storageId: "cover-1", url: "https://cover.example/one.png" },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await enterReview(user);
    const cover = await screen.findByAltText("Second draft");
    expect(cover.getAttribute("src") ?? "").toContain(
      "cover.example%2Ftwo.png",
    );

    await submitFromReview(user);

    await waitFor(() =>
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          proposal: expect.objectContaining({ imageStorageId: "cover-2" }),
        }),
      ),
    );
  });

  it("does not hydrate the submitted body over edits made while saving", async () => {
    const user = userEvent.setup();
    let resolveSave: (value: unknown) => void = () => {};
    saveDraftMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your post a title"),
      "Reviewable",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );
    expect(screen.getByText(JSON.stringify(emptyDocument))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Set short blog content" }),
    );

    resolveSave({ postId: "draft-1", updatedAt: 1, status: "draft" });
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalled());

    // The stale submitted body must not replace the editor content that was
    // typed while the save was in flight.
    expect(screen.queryByText(JSON.stringify(validEnvelope))).toBeNull();
    expect(screen.getByText(JSON.stringify(emptyDocument))).toBeInTheDocument();
  });
});
