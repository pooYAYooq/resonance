import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";
import { DiscoverPostSummary } from "./DiscoverPostSummary";

describe("DiscoverPostSummary", () => {
  it("renders projected content and engagement without serialized body data", () => {
    const dateFormatter = vi.spyOn(Date.prototype, "toLocaleDateString");

    render(
      <DiscoverPostSummary
        post={{
          _id: "post-1" as Id<"posts">,
          title: "Readable title",
          bodyText: "A plain text excerpt",
          authorId: "author-1",
          authorName: "Ari",
          tags: ["Technology"],
          imageUrl: null,
          publishedAt: Date.UTC(2026, 0, 2),
          commentCount: 3,
          likeCount: 8,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Readable title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A plain text excerpt")).toBeInTheDocument();
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByAltText("Readable title")).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveAttribute(
      "datetime",
      "2026-01-02T00:00:00.000Z",
    );
    expect(screen.getByRole("time")).toHaveTextContent("Jan 2, 2026");
    expect(dateFormatter).toHaveBeenCalledWith(
      "en-US",
      expect.objectContaining({ timeZone: "UTC" }),
    );
    dateFormatter.mockRestore();
    expect(screen.getByTestId("discover-card-header")).toBeInTheDocument();
    expect(screen.getByTestId("discover-card-content")).toBeInTheDocument();
    expect(screen.queryByText(/\{.*blocks/i)).not.toBeInTheDocument();
  });
});
