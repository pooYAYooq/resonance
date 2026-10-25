import { beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import type { Id } from "@/convex/_generated/dataModel";
const { auth, create, push } = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(),
  push: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => auth(),
  useMutation: () => create,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { CommentComposer } from "./CommentComposer";
const postId = "post-1" as Id<"posts">;
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue({ isAuthenticated: true, isLoading: false });
  create.mockResolvedValue("comment-1");
});
it("hydrates safely when authentication resolves between SSR and hydration", async () => {
  auth.mockReturnValue({ isAuthenticated: false, isLoading: false });
  const host = document.createElement("div");
  host.innerHTML = renderToString(<CommentComposer postId={postId} />);
  document.body.append(host);
  auth.mockReturnValue({ isAuthenticated: true, isLoading: false });
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(host, <CommentComposer postId={postId} />, {
      onRecoverableError,
    });
  });
  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(host.querySelector("form")).not.toBeNull();
  await act(async () => root.unmount());
  host.remove();
});
it("submits a post-level reply through the shared mutation and clears it", async () => {
  const user = userEvent.setup();
  render(<CommentComposer postId={postId} />);
  await user.type(
    screen.getByPlaceholderText("Add a comment..."),
    "A helpful reply",
  );
  await user.click(screen.getByRole("button", { name: "Comment" }));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith({ postId, body: "A helpful reply" }),
  );
  await waitFor(() =>
    expect(screen.getByPlaceholderText("Add a comment...")).toHaveValue(""),
  );
});
