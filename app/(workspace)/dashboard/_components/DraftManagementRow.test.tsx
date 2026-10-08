import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { DraftManagementRow } from "./DraftManagementRow";

const draft: ComponentProps<typeof DraftManagementRow>["draft"] = {
  _id: "draft-1" as ComponentProps<typeof DraftManagementRow>["draft"]["_id"],
  title: "Unfinished story",
  updatedAt: Date.UTC(2026, 9, 5),
  tags: ["Design"],
  imageUrl: null,
};

describe("DraftManagementRow", () => {
  it("identifies pending updates and resumes the original published post editor", () => {
    render(
      <DraftManagementRow
        draft={{ ...draft, sourcePostId: "post-1" as typeof draft._id }}
        deleting={false}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Pending update")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Resume Unfinished story" }),
    ).toHaveAttribute("href", "/create?editPostId=post-1");
    expect(
      screen.getByRole("link", { name: "Unfinished story" }),
    ).toHaveAttribute("href", "/create?editPostId=post-1");
  });
  it("links title and Resume to the saved draft, not the public reader", () => {
    render(
      <DraftManagementRow draft={draft} deleting={false} onDelete={vi.fn()} />,
    );
    for (const name of ["Unfinished story", "Resume Unfinished story"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        "/create?draftId=draft-1",
      );
    }
    expect(screen.getByText("Last saved 5 Oct 2026")).toHaveAttribute(
      "datetime",
      "2026-10-05T00:00:00.000Z",
    );
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });

  it("keeps the blank cover and untitled fallback for an unfinished draft", () => {
    render(
      <DraftManagementRow
        draft={{ ...draft, title: "  ", tags: [] }}
        deleting={false}
        onDelete={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Untitled draft" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("default-cover")).toBeInTheDocument();
    expect(screen.getByText("No tags")).toBeInTheDocument();
  });

  it("renders an uploaded cover in place of the blank fallback", () => {
    const { container } = render(
      <DraftManagementRow
        draft={{ ...draft, imageUrl: "/cover.png" }}
        deleting={false}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("default-cover")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      "cover.png",
    );
  });

  it("disables deletion and announces busy state while pending", () => {
    render(<DraftManagementRow draft={draft} deleting onDelete={vi.fn()} />);
    expect(screen.getByRole("article")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: "Delete Unfinished story" }),
    ).toBeDisabled();
  });
});
