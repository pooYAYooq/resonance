import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { BlogTopicsMenu } from "./BlogTopicsMenu";

const topics = [
  { tag: "Technology", publishedCount: 12 },
  { tag: "Design", publishedCount: 3 },
  { tag: "NotACanonicalTag", publishedCount: 1 },
];

describe("BlogTopicsMenu", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("is closed by default and keeps the panel out of the layout", () => {
    render(<BlogTopicsMenu topics={topics} mode={{ mode: "latest" }} />);

    const trigger = screen.getByRole("button", { name: /topics/i });
    const panel = document.getElementById("blog-topics-panel");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveClass("rounded-none");
    expect(screen.getByTestId("blog-topics-control")).toHaveClass(
      "h-14",
      "w-full",
    );
    expect(panel).toHaveAttribute("hidden");
    expect(panel).toHaveClass("absolute");
    expect(screen.queryByText("NotACanonicalTag")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Clear topic" }),
    ).not.toBeInTheDocument();
  });

  it("opens the topic panel without moving the trigger and marks the active topic", async () => {
    const user = userEvent.setup();
    render(
      <BlogTopicsMenu
        topics={topics}
        mode={{ mode: "topic", tag: "Technology" }}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: /topics: technology/i,
    });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("blog-topics-panel")).not.toHaveAttribute(
      "hidden",
    );
    expect(screen.getByRole("link", { name: "Technology" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Technology" })).not.toHaveClass(
      "underline",
    );
    expect(screen.getByRole("link", { name: "Design" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("orders topics by published count and keeps All topics first", async () => {
    const user = userEvent.setup();
    render(
      <BlogTopicsMenu
        topics={[
          { tag: "Design", publishedCount: 3 },
          { tag: "Technology", publishedCount: 12 },
          { tag: "Culture", publishedCount: 5 },
        ]}
        mode={{ mode: "latest" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /topics/i }));

    const links = screen
      .getAllByRole("link")
      .map((link) => link.textContent?.trim());
    expect(links).toEqual(["All topics", "Technology", "Culture", "Design"]);
  });

  it("keeps the selected All topics link colored without an underline", async () => {
    const user = userEvent.setup();
    render(<BlogTopicsMenu topics={topics} mode={{ mode: "latest" }} />);

    await user.click(screen.getByRole("button", { name: /topics/i }));

    const allTopics = screen.getByRole("link", { name: "All topics" });
    expect(allTopics).toHaveAttribute("aria-current", "page");
    expect(allTopics).toHaveClass("text-primary");
    expect(allTopics).not.toHaveClass("underline");
  });

  it("clears an active topic without scrolling to the top", async () => {
    const user = userEvent.setup();
    render(
      <BlogTopicsMenu
        topics={topics}
        mode={{ mode: "topic", tag: "Technology" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear topic" }));

    expect(push).toHaveBeenCalledWith("/blog#blog-results");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<BlogTopicsMenu topics={topics} mode={{ mode: "latest" }} />);

    const trigger = screen.getByRole("button", { name: /topics/i });
    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("closes on an outside pointer down", async () => {
    const user = userEvent.setup();
    render(<BlogTopicsMenu topics={topics} mode={{ mode: "latest" }} />);

    const trigger = screen.getByRole("button", { name: /topics/i });
    await user.click(trigger);
    fireEvent.pointerDown(document.body);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes after choosing a topic", async () => {
    const user = userEvent.setup();
    render(<BlogTopicsMenu topics={topics} mode={{ mode: "latest" }} />);

    const trigger = screen.getByRole("button", { name: /topics/i });
    await user.click(trigger);
    await user.click(screen.getByRole("link", { name: "Design" }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("renders nothing when there are no canonical topics", () => {
    const { container } = render(
      <BlogTopicsMenu
        topics={[{ tag: "NotACanonicalTag", publishedCount: 1 }]}
        mode={{ mode: "latest" }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
