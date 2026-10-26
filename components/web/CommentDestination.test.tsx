import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { CommentDestination } from "./CommentDestination";
const { query, auth } = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => query(...args),
  useConvexAuth: () => auth(),
}));
vi.mock("./CommentCard", () => ({
  CommentCard: ({ body, commentId }: { body: string; commentId: string }) => (
    <article id={`comment-${commentId}`} tabIndex={-1}>
      {body}
    </article>
  ),
}));
vi.mock("./CommentComposer", () => ({
  CommentComposer: () => <form aria-label="Reply" />,
}));
const initialData = {
  post: { id: "post1", title: "Post title", authorName: "Author" },
  comment: { _id: "comment1", body: "The selected comment body" },
  nearby: [{ _id: "comment2", body: "Nearby comment" }],
} as unknown as FunctionReturnType<typeof api.comments.getCommentDestination>;
beforeEach(() => {
  query.mockReset();
  auth.mockReturnValue({ isLoading: false, isAuthenticated: true });
});
it("renders the selected comment from server data before the client query resolves", () => {
  render(
    <CommentDestination
      postId="post1"
      commentId="comment1"
      initialData={initialData}
    />,
  );
  expect(screen.getAllByRole("article").map((el) => el.textContent)).toEqual([
    "The selected comment body",
    "Nearby comment",
  ]);
  expect(screen.getByRole("link", { name: "Read full post" })).toHaveAttribute(
    "href",
    "/blog/post1",
  );
  expect(screen.getByRole("form", { name: "Reply" })).toBeInTheDocument();
});
it("skips viewer-aware reads during auth resolution while retaining initial content", () => {
  auth.mockReturnValue({ isLoading: true, isAuthenticated: false });
  render(
    <CommentDestination
      postId="post1"
      commentId="comment1"
      initialData={initialData}
    />,
  );
  expect(query).toHaveBeenLastCalledWith(expect.anything(), "skip");
  expect(screen.getByText("The selected comment body")).toBeInTheDocument();
});
it("responds to deletion instead of restoring stale server data", () => {
  query.mockReturnValue({ ...initialData, comment: null, nearby: [] });
  const { rerender } = render(
    <CommentDestination
      postId="post1"
      commentId="comment1"
      initialData={initialData}
    />,
  );
  expect(
    screen.getByText("This comment is no longer available."),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("The selected comment body"),
  ).not.toBeInTheDocument();
  query.mockReturnValue(null);
  rerender(
    <CommentDestination
      postId="post1"
      commentId="comment1"
      initialData={initialData}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Post unavailable" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
});

afterEach(() => {
  vi.useRealTimers();
  document
    .querySelectorAll("[data-notification-drawer]")
    .forEach((el) => el.remove());
});
function mountDestination(
  data: FunctionReturnType<
    typeof api.comments.getCommentDestination
  > = initialData,
) {
  return render(
    <CommentDestination
      postId="post1"
      commentId="comment1"
      initialData={data}
    />,
  );
}
function drawer() {
  const el = document.createElement("div");
  el.setAttribute("data-notification-drawer", "");
  document.body.append(el);
  return el;
}
it("renders a public conversation for a logged-out reader", () => {
  auth.mockReturnValue({ isLoading: false, isAuthenticated: false });
  mountDestination();
  expect(screen.getByText("The selected comment body")).toBeInTheDocument();
  expect(screen.getByText("Nearby comment")).toBeInTheDocument();
  expect(screen.queryByText("Post unavailable")).not.toBeInTheDocument();
});
it("focuses the selected comment without scrolling", () => {
  const focus = vi.spyOn(HTMLElement.prototype, "focus");
  mountDestination();
  expect(screen.getAllByRole("article")[0]).toHaveFocus();
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  focus.mockRestore();
});
it("waits for drawer removal before focusing", async () => {
  const sheet = drawer();
  mountDestination();
  expect(screen.getAllByRole("article")[0]).not.toHaveFocus();
  await act(async () => {
    sheet.remove();
  });
  expect(screen.getAllByRole("article")[0]).toHaveFocus();
});
it("focuses the selected heading when the comment is missing", () => {
  mountDestination({ ...initialData!, comment: null, nearby: [] });
  expect(screen.getByRole("heading", { name: "Comment" })).toHaveFocus();
});
it.each(["pointerdown", "keydown"])(
  "does not steal focus after %s",
  async (event) => {
    const sheet = drawer();
    mountDestination();
    fireEvent(document, new Event(event, { bubbles: true }));
    const link = screen.getByRole("link", { name: "Read full post" });
    link.focus();
    await act(async () => {
      sheet.remove();
    });
    expect(link).toHaveFocus();
  },
);
it("abandons focus after the drawer timeout", async () => {
  vi.useFakeTimers();
  const sheet = drawer();
  mountDestination();
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  await act(async () => {
    sheet.remove();
  });
  expect(screen.getAllByRole("article")[0]).not.toHaveFocus();
});
it("cleans up a pending focus on unmount", async () => {
  const sheet = drawer();
  const focus = vi.spyOn(HTMLElement.prototype, "focus");
  const view = mountDestination();
  view.unmount();
  await act(async () => {
    sheet.remove();
  });
  expect(focus).not.toHaveBeenCalled();
  focus.mockRestore();
});
