import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostAuthorLine } from "./PostAuthorLine";

const base = {
  authorId: "author-1",
  authorName: "Ari",
  authorUsername: "ari",
  authorAvatarUrl: null,
  date: Date.UTC(2026, 9, 30, 10, 0, 0),
};

describe("PostAuthorLine", () => {
  it("links the author and shows relative time", () => {
    render(
      <PostAuthorLine
        {...base}
        dateMode="relative"
        now={Date.UTC(2026, 9, 30, 12, 0, 0)}
      />,
    );

    expect(screen.getByRole("link", { name: "Ari" })).toHaveAttribute(
      "href",
      "/u/ari",
    );
    const time = screen.getByText("2h ago");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-10-30T10:00:00.000Z");
    expect(time).toHaveAttribute("title", "Oct 30, 2026");
    expect(screen.getByText("·")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows an absolute UTC date without the Published label", () => {
    render(
      <PostAuthorLine
        {...base}
        date={Date.UTC(2026, 9, 30, 0, 30)}
        dateMode="absolute"
      />,
    );

    expect(screen.getByText("Oct 30, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Published/)).toBeNull();
  });

  it("renders a plain unknown author and no link without a username", () => {
    render(
      <PostAuthorLine
        {...base}
        authorName={null}
        authorUsername={null}
        dateMode="absolute"
      />,
    );

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("renders a named author without a link when no username exists", () => {
    render(
      <PostAuthorLine {...base} authorUsername={null} dateMode="absolute" />,
    );

    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("omits the separator and time when no date is provided", () => {
    const { container } = render(
      <PostAuthorLine {...base} date={null} dateMode="absolute" />,
    );

    expect(screen.getByRole("link", { name: "Ari" })).toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
    expect(screen.queryByText("·")).toBeNull();
  });

  it("supports a larger responsive avatar for collection cards", () => {
    const { container } = render(
      <PostAuthorLine {...base} date={null} avatarSize="md" />,
    );

    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass(
      "size-6",
      "sm:size-[30px]",
    );
  });

  it("accepts truncation classes and exposes the full name as a title", () => {
    render(
      <PostAuthorLine {...base} date={null} nameClassName="max-w-[20ch]" />,
    );

    const link = screen.getByRole("link", { name: "Ari" });
    expect(link).toHaveClass("max-w-[20ch]");
    expect(link).toHaveAttribute("title", "Ari");
  });
});
