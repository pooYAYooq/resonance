import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { PublishedRow } from "./PublishedRow";

const post: ComponentProps<typeof PublishedRow>["post"] = {
  _id: "post-1" as ComponentProps<typeof PublishedRow>["post"]["_id"],
  title: "A published story",
  imageUrl: null,
  tags: ["Art & Culture", "Science"],
  createdAt: Date.UTC(2026, 8, 1),
  publishedAt: Date.UTC(2026, 8, 2),
  updatedAt: Date.UTC(2026, 8, 3),
  likeCount: 1,
  commentCount: 2,
};

describe("PublishedRow", () => {
  it("shows publication and subsequent update dates, linked tags, and read-only engagement", () => {
    render(<PublishedRow post={post} deleting={false} onDelete={vi.fn()} />);
    expect(screen.getByText("Published 2 Sept 2026")).toHaveAttribute(
      "datetime",
      "2026-09-02T00:00:00.000Z",
    );
    expect(screen.getByText("Updated 3 Sept 2026")).toHaveAttribute(
      "datetime",
      "2026-09-03T00:00:00.000Z",
    );
    expect(screen.getByRole("link", { name: "Art & Culture" })).toHaveAttribute(
      "href",
      "/blog?tag=Art%20%26%20Culture",
    );
    expect(screen.getByText("1 like")).toBeInTheDocument();
    expect(screen.getByText("2 comments")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /like|comment/i }),
    ).not.toBeInTheDocument();
  });

  it("falls back to creation date and reserves the metadata line when tags are absent", () => {
    render(
      <PublishedRow
        post={{
          ...post,
          publishedAt: undefined,
          updatedAt: post.createdAt,
          tags: [],
        }}
        deleting={false}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Published 1 Sept 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
    expect(screen.getByText("No tags")).toBeInTheDocument();
  });

  it("requests confirmation and disables the pending deletion action", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <PublishedRow post={post} deleting={false} onDelete={onDelete} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Delete A published story" }),
    );
    expect(onDelete).toHaveBeenCalledOnce();
    view.rerender(<PublishedRow post={post} deleting onDelete={onDelete} />);
    expect(screen.getByRole("article")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: "Delete A published story" }),
    ).toBeDisabled();
  });
});
