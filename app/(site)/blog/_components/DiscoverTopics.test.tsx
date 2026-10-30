import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth-server", () => ({ fetchAuthQuery: vi.fn() }));

import { DiscoverTopics } from "./DiscoverTopics";

describe("DiscoverTopics", () => {
  it("uses canonical topic links and shows published counts", async () => {
    render(
      await DiscoverTopics({
        topics: [
          { tag: "Technology", publishedCount: 12 },
          { tag: "Design", publishedCount: 3 },
        ],
      }),
    );

    expect(screen.getByRole("link", { name: /technology/i })).toHaveAttribute(
      "href",
      "/blog?tag=Technology#blog-results",
    );
    expect(screen.getByText("12 posts")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Clear topic" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveClass(
      "grid-cols-2",
      "xl:grid-cols-1",
    );
  });

  it("marks only the active canonical topic", async () => {
    render(
      await DiscoverTopics({
        mode: { mode: "topic", tag: "Technology" },
        topics: [
          { tag: "Technology", publishedCount: 12 },
          { tag: "Design", publishedCount: 3 },
        ],
      }),
    );

    expect(screen.getByRole("link", { name: /technology/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /design/i })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Clear topic" })).toHaveAttribute(
      "href",
      "/blog#blog-results",
    );
  });

  it("renders an empty recovery state when no topics are available", async () => {
    render(await DiscoverTopics({ topics: [] }));
    expect(screen.getByText(/no topics available/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /browse all posts/i }),
    ).toHaveAttribute("href", "/blog#blog-results");
  });
});
