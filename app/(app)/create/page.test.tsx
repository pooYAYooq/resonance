import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateRoute from "./page";

const {
  pushMock,
  toastSuccessMock,
  toastErrorMock,
  generateImageUploadUrlMock,
  createPostMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  generateImageUploadUrlMock: vi.fn(),
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
    if (apiRef === "createPost") return createPostMock;
    return vi.fn();
  },
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
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
    generateImageUploadUrlMock.mockClear();
    createPostMock.mockClear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows validation error for empty title", async () => {
    const user = userEvent.setup();
    render(<CreateRoute />);

    await user.type(
      screen.getByPlaceholderText(
        "Let the world know what you are thinking...",
      ),
      "Some content here",
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
    await user.type(
      screen.getByPlaceholderText(
        "Let the world know what you are thinking...",
      ),
      "This is enough content for the body.",
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
    await user.type(
      screen.getByPlaceholderText(
        "Let the world know what you are thinking...",
      ),
      "This is enough content for the body.",
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
        body: "This is enough content for the body.",
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
    await user.type(
      screen.getByPlaceholderText(
        "Let the world know what you are thinking...",
      ),
      "This is enough content for the body.",
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
    await user.type(
      screen.getByPlaceholderText(
        "Let the world know what you are thinking...",
      ),
      "This is enough content for the body.",
    );

    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(createPostMock).toHaveBeenCalledWith({
        title: "My Post",
        body: "This is enough content for the body.",
      });
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Post created successfully!",
      );
      expect(pushMock).toHaveBeenCalledWith("/blog");
    });

    expect(generateImageUploadUrlMock).not.toHaveBeenCalled();
  });
});
