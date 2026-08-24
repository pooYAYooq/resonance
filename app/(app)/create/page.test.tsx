import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BlockNoteDocument } from "@/lib/post-content";
import CreateRoute from "./page";

const validEnvelope: BlockNoteDocument = {
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
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
        storageId: "storage-inline-1",
        altText: "Inline image",
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
  onUploadSessionCreated?: (sessionId: string, storageId: string) => void;
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
          onUploadSessionCreated?.("session-inline-1", "storage-inline-1")
        }
      >
        Register inline upload
      </button>
      <button
        type="button"
        aria-label="Register later inline upload"
        onClick={() =>
          onUploadSessionCreated?.("session-inline-2", "storage-inline-2")
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
  toastSuccessMock,
  toastErrorMock,
  cleanupPendingUploadsMock,
  createPendingUploadMock,
  finalizePendingUploadMock,
  saveDraftMock,
  publishPostMock,
  getDraftByIdMock,
  getPublishedPostForEditingMock,
  updatePublishedPostMock,
  draftIdParam,
  editPostIdParam,
  routerMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  createPendingUploadMock: vi.fn(),
  finalizePendingUploadMock: vi.fn(),
  cleanupPendingUploadsMock: vi.fn(),
  saveDraftMock: vi.fn(),
  publishPostMock: vi.fn(),
  getDraftByIdMock: vi.fn(),
  getPublishedPostForEditingMock: vi.fn(),
  updatePublishedPostMock: vi.fn(),
  draftIdParam: { value: undefined as string | undefined },
  editPostIdParam: { value: undefined as string | undefined },
  routerMock: { push: vi.fn(), replace: vi.fn() },
}));

let fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => ({
    get: (key: string) =>
      key === "draftId" ? draftIdParam.value : editPostIdParam.value,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (apiRef: unknown) => {
    if (apiRef === "createPendingUpload") return createPendingUploadMock;
    if (apiRef === "finalizePendingUpload") return finalizePendingUploadMock;
    if (apiRef === "cleanupPending") return cleanupPendingUploadsMock;
    if (apiRef === "saveDraft") return saveDraftMock;
    if (apiRef === "publishPost") return publishPostMock;
    if (apiRef === "updatePublishedPost") return updatePublishedPostMock;
    return vi.fn();
  },
  useQuery: (apiRef: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    if (apiRef === "getDraftById") return getDraftByIdMock();
    if (apiRef === "getPublishedPostForEditing") {
      return getPublishedPostForEditingMock();
    }
    return undefined;
  },
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
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
  },
}));

describe("CreateRoute", () => {
  beforeEach(() => {
    routerMock.push = pushMock;
    routerMock.replace = pushMock;
    pushMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    createPendingUploadMock.mockReset();
    finalizePendingUploadMock.mockReset();
    cleanupPendingUploadsMock.mockReset();
    saveDraftMock.mockReset();
    publishPostMock.mockReset();
    getDraftByIdMock.mockReset();
    getPublishedPostForEditingMock.mockReset();
    updatePublishedPostMock.mockReset();
    draftIdParam.value = undefined;
    editPostIdParam.value = undefined;
    createPendingUploadMock.mockResolvedValue({
      sessionId: "session-cover",
      uploadUrl: "https://upload.url",
      expiresAt: 1_000,
    });
    finalizePendingUploadMock.mockResolvedValue(null);
    saveDraftMock.mockResolvedValue({ draftId: "draft-1", updatedAt: 1 });
    publishPostMock.mockResolvedValue("draft-1");
    updatePublishedPostMock.mockResolvedValue("post-1");
    getDraftByIdMock.mockReturnValue(undefined);
    getPublishedPostForEditingMock.mockReturnValue(undefined);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(screen.getByText("Update Published Post")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Edit blog content" }));
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Update Published Post" }));

    await waitFor(() => {
      expect(updatePublishedPostMock).toHaveBeenCalledWith({
        postId: "post-1",
        title: "Published title",
        body: JSON.stringify(validEnvelope),
        tags: ["Technology"],
        imageStorageId: "cover-1",
      });
    });
    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(publishPostMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Post updated successfully!");
    expect(pushMock).toHaveBeenCalledWith("/dashboard/published");
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

  it("redirects an unavailable published edit to published dashboard", async () => {
    editPostIdParam.value = "missing-post";
    getPublishedPostForEditingMock.mockReturnValue(null);

    render(<CreateRoute />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/dashboard/published"),
    );
    expect(toastErrorMock).toHaveBeenCalledWith(
      "That published post is unavailable.",
    );
  });

  it("redirects an invalid dual-target request to the dashboard", async () => {
    draftIdParam.value = "draft-1";
    editPostIdParam.value = "post-1";

    render(<CreateRoute />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(toastErrorMock).toHaveBeenCalledWith("Invalid editor request.");
    expect(getDraftByIdMock).not.toHaveBeenCalled();
    expect(getPublishedPostForEditingMock).not.toHaveBeenCalled();
  });

  it("redirects an unavailable draft to the dashboard drafts route", async () => {
    draftIdParam.value = "missing-draft";
    getDraftByIdMock.mockReturnValue(null);

    render(<CreateRoute />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/dashboard/drafts"),
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
    await user.click(screen.getByRole("button", { name: /publish/i }));

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
        draftId: undefined,
        title: "Unfinished thought",
        body: JSON.stringify({ format: "blocknote@1", blocks: [] }),
        tags: [],
      });
    });
    expect(publishPostMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Draft saved successfully!");
  });

  it("keeps the editor mounted when publish validation fails", async () => {
    const user = userEvent.setup();

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
      "A titled post",
    );
    await user.click(screen.getByRole("button", { name: /publish/i }));

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

    const button = screen.getByRole("button", { name: /publish/i });
    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    expect(screen.getByText(/saving/i)).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /publish/i }));

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
      expect(saveDraftMock).toHaveBeenCalledWith({
        draftId: undefined,
        title: "My Post",
        body: JSON.stringify(validEnvelope),
        tags: [],
        imageStorageId: "storage-123",
      });
    });

    expect(publishPostMock).toHaveBeenCalledWith({ draftId: "draft-1" });

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

    await user.click(screen.getByRole("button", { name: /publish/i }));

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

    await user.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      expect(saveDraftMock).toHaveBeenCalledWith({
        draftId: undefined,
        title: "My Post",
        body: JSON.stringify(validEnvelope),
        tags: [],
      });
    });
    expect(publishPostMock).toHaveBeenCalledWith({ draftId: "draft-1" });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Post published successfully!",
      );
      expect(pushMock).toHaveBeenCalledWith("/blog");
    });

    expect(createPendingUploadMock).not.toHaveBeenCalled();
    expect(cleanupPendingUploadsMock).not.toHaveBeenCalled();
  });

  it("cleans up only the current submit's inline sessions after a failure", async () => {
    const user = userEvent.setup();
    saveDraftMock.mockRejectedValue(new Error("Invalid inline upload claim"));
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
    await user.click(screen.getByRole("button", { name: /publish/i }));

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
    saveDraftMock.mockRejectedValue(new Error("Inline image expired"));
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
    await user.click(screen.getByRole("button", { name: /publish/i }));

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
    // The first claim is consumed by saveDraft/publishPost; the second is
    // newer than the submission snapshot and must not be cleaned up.
    const user = userEvent.setup();
    let rejectPublishPost: ((error: Error) => void) | undefined;
    saveDraftMock.mockResolvedValue({ draftId: "draft-1", updatedAt: 1 });
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
    await user.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => expect(saveDraftMock).toHaveBeenCalled());

    await user.click(
      screen.getByRole("button", { name: "Register later inline upload" }),
    );
    rejectPublishPost?.(new Error("Invalid inline upload claim"));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to save post");
    });
    expect(cleanupPendingUploadsMock).not.toHaveBeenCalled();
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
    await user.click(screen.getByRole("button", { name: /publish/i }));

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
    await user.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      expect(
        screen.getByText((t) => t.includes("Content must contain")),
      ).toBeInTheDocument();
    });

    expect(createPendingUploadMock).not.toHaveBeenCalled();
    expect(saveDraftMock).not.toHaveBeenCalled();
  });
});
