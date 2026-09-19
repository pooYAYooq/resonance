import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BlockNoteDocument } from "@/lib/post-content";
import { saveDraftRecovery, readDraftRecovery } from "@/lib/draft-recovery";
import CreateRoute from "./page";

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
  onChange: (value: BlockNoteDocument) => void;
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
    onUploadSessionCreated,
    initialContent,
    resolvedImageUrls,
  }: MockPostBodyEditorProps) => (
    <>
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
  draftIdParam,
  editPostIdParam,
  useConvexAuthState,
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
  draftIdParam: { value: undefined as string | undefined },
  editPostIdParam: { value: undefined as string | undefined },
  useConvexAuthState: vi.fn(),
  routerMock: { push: vi.fn(), replace: vi.fn() },
}));

let fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
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
    return vi.fn();
  },
  useQuery: (apiRef: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    if (apiRef === "getDraftById") return getDraftByIdMock(args);
    if (apiRef === "getPublishedPostForEditing") {
      return getPublishedPostForEditingMock(args);
    }
    return undefined;
  },
  useConvexAuth: () => useConvexAuthState(),
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
    },
    sessionMediaClaims: {
      claim: "claimSessionMedia",
      renew: "renewSessionMedia",
      release: "releaseSessionMedia",
    },
  },
}));

describe("CreateRoute", () => {
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
    label: "Publish" | "Update Post" = "Publish",
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
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeVisible();
  });

  it("persists a dirty proposal to local storage", async () => {
    render(<CreateRoute />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );

    await waitFor(() => expect(readDraftRecovery("new:new")).not.toBeNull(), {
      timeout: 2500,
    });
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

  it("enters Review and returns to editing with content preserved", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
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

  it("blocks Review while inline media is unresolved", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
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
      "Some media is still uploading. Wait for it to finish before reviewing.",
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
    expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit blog content" }));
    await enterReview(user, "Review Update");
    await submitFromReview(user, "Update Post");

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
    await submitFromReview(user, "Update Post");
    await waitFor(() => {
      expect(reserveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({ postId: "post-1" }),
      );
    });
    expect(reserveAttemptMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ postId: "post-2" }),
    );
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
    await user.click(
      screen.getByRole("button", { name: "Load requested document" }),
    );
    expect(await screen.findByDisplayValue("Post two")).toBeInTheDocument();
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

  it("adopts a new target after successfully saving a selected cover", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "storage-cover" }),
    });
    const view = render(<CreateRoute />);
    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
      "Covered draft",
    );
    await user.upload(
      screen.getByLabelText("Image (optional)"),
      new File(["cover"], "cover.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));
    expect(claimSessionMediaMock).toHaveBeenCalledWith({
      sessionId: "new:new",
      storageId: "storage-cover",
    });

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
      screen.getByPlaceholderText("Give your thought a name"),
      "Covered draft",
    );
    await user.upload(imageInput, firstCover);
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
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
      expect(
        screen.getByText((t) => t.includes("Too small")),
      ).toBeInTheDocument();
    });

    expect(saveDraftMock).not.toHaveBeenCalled();
  });

  it("saves an incomplete draft without publishing", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
      "Unfinished thought",
    );
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

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
      screen.getByPlaceholderText("Give your thought a name"),
      "Two saves",
    );

    const saveButton = screen.getByRole("button", { name: "Save Draft" });
    await user.click(saveButton);
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));

    await user.click(saveButton);
    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(2));

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
      screen.getByPlaceholderText("Give your thought a name"),
      "Draft{Enter}",
    );

    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(publishPostMock).not.toHaveBeenCalled();
  });

  it("keeps the editor mounted when publish validation fails", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
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
      screen.getByPlaceholderText("Give your thought a name"),
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
      screen.getByPlaceholderText("Give your thought a name"),
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
      screen.getByPlaceholderText("Give your thought a name"),
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
      screen.getByPlaceholderText("Give your thought a name"),
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
    publishPostMock.mockRejectedValue(new Error("Invalid inline upload claim"));
    cleanupPendingUploadsMock.mockResolvedValue(null);

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
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
    publishPostMock.mockRejectedValue(new Error("Inline image expired"));
    cleanupPendingUploadsMock.mockRejectedValue(new Error("cleanup failed"));

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
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
    let rejectPublishPost: ((error: Error) => void) | undefined;
    publishPostMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPublishPost = reject;
        }),
    );
    cleanupPendingUploadsMock.mockResolvedValue(null);

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
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
    rejectPublishPost?.(new Error("Invalid inline upload claim"));

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
      screen.getByPlaceholderText("Give your thought a name"),
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
});
