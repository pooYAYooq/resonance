import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { fetchQueryMock } = vi.hoisted(() => ({
  fetchQueryMock: vi.fn(),
}));

vi.mock("convex/nextjs", () => ({ fetchQuery: fetchQueryMock }));
vi.mock("@/convex/_generated/api", () => ({
  api: { posts: { countPosts: "countPosts" } },
}));

import { StatsSection } from "./StatsSection";

describe("StatsSection", () => {
  beforeEach(() => {
    fetchQueryMock.mockReset();
  });

  it("renders the live published-post count when it is zero", async () => {
    fetchQueryMock.mockResolvedValue(0);

    render(await StatsSection());

    expect(fetchQueryMock).toHaveBeenCalledWith("countPosts", {});
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Published Posts")).toBeInTheDocument();
    expect(screen.queryByText("Active Writers")).toBeNull();
    expect(screen.queryByText("Growing")).toBeNull();
    expect(screen.queryByText("Conversations")).toBeNull();
    expect(screen.queryByText("Daily")).toBeNull();
  });
});
