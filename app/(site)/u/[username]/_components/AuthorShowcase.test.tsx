/**
 * Component tests for `AuthorShowcase`.
 *
 * The showcase owns the bounded, live author work: three cards initially, a
 * reveal step, and reconciliation when the live query shrinks or empties. The
 * `useQuery` mock is mutable so a rerender can change the live result; passing
 * new initial props alone must not change what is rendered.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }));

vi.mock("convex/react", () => ({
  useQuery: () => useQueryMock(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    profiles: { getShowcase: "getShowcase" },
  },
}));

import { AuthorShowcase } from "./AuthorShowcase";
import type { AuthorCard } from "@/components/web/AuthorPostCard";

const card = (n: number): AuthorCard => ({
  postId: `post-${n}`,
  title: `Post ${n}`,
  imageUrl: `https://cdn.example/${n}.png`,
  likeCount: n,
});

const nine = Array.from({ length: 9 }, (_, index) => card(index + 1));

const cardLinks = () => screen.getAllByRole("link", { name: /^post \d+$/i });

const empty = { mode: "latest" as const, posts: [] as AuthorCard[] };

describe("AuthorShowcase", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({ mode: "selected", posts: nine });
  });

  it("renders the live result rather than the initial props", () => {
    render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: [card(99)] }}
      />,
    );

    expect(cardLinks()).toHaveLength(3);
    expect(screen.queryByRole("link", { name: "Post 99" })).toBeNull();
  });

  it("does not let a new initial prop bypass the subscription", () => {
    const { rerender } = render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );
    expect(cardLinks()).toHaveLength(3);

    rerender(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={empty}
      />,
    );

    expect(cardLinks()).toHaveLength(3);
  });

  it("reveals three more cards at a time and announces the visible count", async () => {
    const user = userEvent.setup();
    render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "A few of my favourites" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More of my work" }));

    expect(cardLinks()).toHaveLength(6);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 6 of 9 posts.",
    );

    await user.click(screen.getByRole("button", { name: "More of my work" }));

    expect(cardLinks()).toHaveLength(9);
    expect(
      screen.queryByRole("button", { name: "More of my work" }),
    ).toBeNull();
  });

  it("keeps surviving cards mounted, clamps the revealed count, and re-derives the status when posts are deleted", () => {
    const { rerender } = render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More of my work" }));
    expect(cardLinks()).toHaveLength(6);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 6 of 9 posts.",
    );
    const firstCard = cardLinks()[0];

    const survivors = [card(1), card(2), card(5), card(7)];
    useQueryMock.mockReturnValue({ mode: "selected", posts: survivors });
    rerender(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: survivors }}
      />,
    );

    expect(cardLinks()).toHaveLength(4);
    expect(cardLinks()[0]).toBe(firstCard);
    expect(screen.getByRole("link", { name: "Post 5" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Post 3" })).toBeNull();
    // The announcement is derived from the live totals, never a snapshot.
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 4 of 4 posts.",
    );
  });

  it("clears the announcement when the author changes", () => {
    const { rerender } = render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More of my work" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 6 of 9 posts.",
    );

    rerender(
      <AuthorShowcase
        userId="other-author"
        username="other"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );

    expect(cardLinks()).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("moves focus to the first newly revealed card", () => {
    render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );
    const button = screen.getByRole("button", { name: "More of my work" });
    button.focus();
    fireEvent.click(button);

    expect(cardLinks()[3]).toHaveFocus();
  });

  it("moves focus to the focusable work context when the final posts are deleted", () => {
    const { rerender } = render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );
    const card = cardLinks()[0];
    card.focus();
    expect(card).toHaveFocus();

    useQueryMock.mockReturnValue(empty);
    rerender(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={empty}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("author-showcase")).toHaveFocus();
  });

  it("moves focus to the work context when a revealed selection is emptied", () => {
    const { rerender } = render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More of my work" }));
    const button = screen.getByRole("button", { name: "More of my work" });
    button.focus();
    expect(button).toHaveFocus();

    useQueryMock.mockReturnValue(empty);
    rerender(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={empty}
      />,
    );

    expect(screen.getByTestId("author-showcase")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("resets the reveal when the author changes", () => {
    const { rerender } = render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More of my work" }));
    expect(cardLinks()).toHaveLength(6);

    rerender(
      <AuthorShowcase
        userId="other-author"
        username="other"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );

    expect(cardLinks()).toHaveLength(3);
  });

  it("uses the latest heading and never offers a reveal", () => {
    useQueryMock.mockReturnValue({
      mode: "latest",
      posts: [card(1), card(2), card(3)],
    });
    render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={empty}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Latest posts" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More of my work" }),
    ).toBeNull();
  });

  it("renders no visible work area when there are no published posts", () => {
    useQueryMock.mockReturnValue({ mode: "latest", posts: [] });
    render(
      <AuthorShowcase
        userId="author"
        username="maya"
        initialShowcase={empty}
      />,
    );

    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    // The focus context and the (empty) live region remain, but they render no
    // visible content and reserve no space.
    expect(screen.getByTestId("author-showcase").textContent).toBe("");
  });

  it("links to the lower-case post catalogue only when work and a username exist", () => {
    const { rerender } = render(
      <AuthorShowcase
        userId="author"
        username="MayaB"
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );

    const catalogue = screen.getByRole("link", { name: /all my posts/i });
    expect(catalogue).toHaveAttribute("href", "/u/mayab/posts");

    rerender(
      <AuthorShowcase
        userId="author"
        username={null}
        initialShowcase={{ mode: "selected", posts: nine }}
      />,
    );
    expect(screen.queryByRole("link", { name: /all my posts/i })).toBeNull();
  });
});
