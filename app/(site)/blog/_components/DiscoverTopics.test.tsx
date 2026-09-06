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
      "/blog?tag=Technology",
    );
    expect(screen.getByText("12 posts")).toBeInTheDocument();
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
  });

  it("renders an empty recovery state when no topics are available", async () => {
    render(await DiscoverTopics({ topics: [] }));
    expect(screen.getByText(/no topics available/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /browse latest/i }),
    ).toHaveAttribute("href", "/blog");
  });
});
