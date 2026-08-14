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
};

vi.mock("./_components/PostBodyEditor", () => ({
  default: ({ onChange, onUploadSessionCreated }: MockPostBodyEditorProps) => (
    <>
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
  generateImageUploadUrlMock,
  cleanupPendingUploadsMock,
  createPostMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  generateImageUploadUrlMock: vi.fn(),
  cleanupPendingUploadsMock: vi.fn(),
  createPostMock: vi.fn(),
}));

let fetchMock = vi.fn();

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
  useMutation: (apiRef: unknown) => {
    if (apiRef === "generateImageUploadUrl") return generateImageUploadUrlMock;
    if (apiRef === "cleanupPending") return cleanupPendingUploadsMock;
    if (apiRef === "createPost") return createPostMock;
    return vi.fn();
  },
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    pendingUploads: {
      cleanupPending: "cleanupPending",
    },
    posts: {
      generateImageUploadUrl: "generateImageUploadUrl",
      createPost: "createPost",
    },
  },
}));

describe("CreateRoute", () => {
  beforeEach(() => {
    pushMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    generateImageUploadUrlMock.mockReset();
    cleanupPendingUploadsMock.mockReset();
    createPostMock.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(
        screen.getByText((t) => t.includes("Too small")),
      ).toBeInTheDocument();
    });

    expect(createPostMock).not.toHaveBeenCalled();
  });

  it("disables submit button while pending", async () => {
    const user = userEvent.setup();

    // Hang the mutation so the pending state stays visible
    generateImageUploadUrlMock.mockImplementation(
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

    const button = screen.getByRole("button", { name: /create post/i });
    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    expect(screen.getByText(/creating/i)).toBeInTheDocument();
  });

  it("submits successfully and redirects", async () => {
    const user = userEvent.setup();

    generateImageUploadUrlMock.mockResolvedValue("https://upload.url");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "storage-123" }),
    });
    createPostMock.mockResolvedValue(undefined);

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

    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(generateImageUploadUrlMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("https://upload.url", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: expect.any(File),
      });
    });

    await waitFor(() => {
      expect(createPostMock).toHaveBeenCalledWith({
        title: "My Post",
        body: JSON.stringify(validEnvelope),
        tags: [],
        imageStorageId: "storage-123",
      });
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Post created successfully!",
      );
      expect(pushMock).toHaveBeenCalledWith("/blog");
    });
  });

  it("shows error toast when image upload fails", async () => {
    const user = userEvent.setup();

    generateImageUploadUrlMock.mockResolvedValue("https://upload.url");
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

    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to upload image");
    });

    expect(createPostMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("creates a text-only post successfully without imageStorageId", async () => {
    const user = userEvent.setup();

    createPostMock.mockResolvedValue(undefined);

    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText("Give your thought a name"),
      "My Post",
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit blog content" }),
    );

    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(createPostMock).toHaveBeenCalledWith({
        title: "My Post",
        body: JSON.stringify(validEnvelope),
        tags: [],
      });
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Post created successfully!",
      );
      expect(pushMock).toHaveBeenCalledWith("/blog");
    });

    expect(generateImageUploadUrlMock).not.toHaveBeenCalled();
    expect(cleanupPendingUploadsMock).not.toHaveBeenCalled();
  });

  it("cleans up only the current submit's inline sessions after a failure", async () => {
    const user = userEvent.setup();
    createPostMock.mockRejectedValue(new Error("Invalid inline upload claim"));
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
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(cleanupPendingUploadsMock).toHaveBeenCalledWith({
        uploads: [
          { sessionId: "session-inline-1", storageId: "storage-inline-1" },
        ],
      });
    });
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to create post");
  });

  it("shows the inline expiry recovery message and preserves it when cleanup fails", async () => {
    const user = userEvent.setup();
    createPostMock.mockRejectedValue(new Error("Inline image expired"));
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
    await user.click(screen.getByRole("button", { name: /create post/i }));

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
    // The first claim is consumed by createPost; the second is newer than the
    // submission snapshot. Neither session belongs in failed-submit cleanup.
    const user = userEvent.setup();
    let rejectCreatePost: ((error: Error) => void) | undefined;
    createPostMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectCreatePost = reject;
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
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => expect(createPostMock).toHaveBeenCalled());

    await user.click(
      screen.getByRole("button", { name: "Register later inline upload" }),
    );
    rejectCreatePost?.(new Error("Invalid inline upload claim"));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to create post");
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
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(
        screen.getByText((t) => t.includes("Content must contain")),
      ).toBeInTheDocument();
    });

    expect(generateImageUploadUrlMock).not.toHaveBeenCalled();
    expect(createPostMock).not.toHaveBeenCalled();

    await user.click(
      await screen.findByRole("button", { name: "Set short blog content" }),
    );
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(
        screen.getByText((t) => t.includes("Content must contain")),
      ).toBeInTheDocument();
    });

    expect(generateImageUploadUrlMock).not.toHaveBeenCalled();
    expect(createPostMock).not.toHaveBeenCalled();
  });
});
