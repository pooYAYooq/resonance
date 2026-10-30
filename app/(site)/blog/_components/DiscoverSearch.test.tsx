import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { DiscoverSearch } from "./DiscoverSearch";

describe("DiscoverSearch", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("is the primary full-width search entry point with a normalized value", () => {
    render(<DiscoverSearch query="  design  " />);

    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
    expect(screen.getByRole("searchbox")).toHaveClass(
      "[&::-webkit-search-cancel-button]:hidden",
    );
    expect(screen.getByRole("searchbox")).toHaveValue("design");
    expect(screen.getByRole("search")).toHaveAttribute(
      "action",
      "/blog#blog-results",
    );
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute(
      "data-slot",
      "button",
    );
    const clear = screen.getByRole("button", { name: "Clear search" });
    expect(clear).toBeInTheDocument();
    expect(clear.querySelector("span")).toHaveClass("rounded-full", "bg-muted");
  });

  it("clears an active search and returns to All posts", async () => {
    const user = userEvent.setup();
    render(<DiscoverSearch query="design" />);

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(push).toHaveBeenCalledWith("/blog#blog-results");
  });

  it("returns to All posts when an active search is emptied by hand", async () => {
    const user = userEvent.setup();
    render(<DiscoverSearch query="design" />);

    await user.clear(screen.getByRole("searchbox"));

    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(push).toHaveBeenCalledWith("/blog#blog-results");
  });

  it("does not navigate when a draft search with no active query is cleared", async () => {
    const user = userEvent.setup();
    render(<DiscoverSearch query="" />);

    await user.type(screen.getByRole("searchbox"), "design");
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(push).not.toHaveBeenCalled();
  });

  it("submits a search query and reverts to All posts for an empty submit", async () => {
    const user = userEvent.setup();
    render(<DiscoverSearch query="" />);

    await user.type(screen.getByRole("searchbox"), " design ");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenLastCalledWith("/blog?q=design#blog-results");

    await user.clear(screen.getByRole("searchbox"));
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenLastCalledWith("/blog#blog-results");
  });

  it("hides the clear control when the field is empty", () => {
    render(<DiscoverSearch query="" />);

    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });

  it("synchronizes the input on Back/Forward query changes", async () => {
    const user = userEvent.setup();
    const view = render(<DiscoverSearch query="design" />);
    const input = screen.getByRole("searchbox");
    await user.type(input, " draft");

    view.rerender(<DiscoverSearch query="photography" />);
    expect(input).toHaveValue("photography");
    view.rerender(<DiscoverSearch query="design" />);
    expect(input).toHaveValue("design");
    expect(input).toHaveFocus();
  });

  it("clears the draft when external navigation leaves search mode", async () => {
    const user = userEvent.setup();
    const view = render(<DiscoverSearch query="design" />);
    const input = screen.getByRole("searchbox");
    await user.type(input, " draft");

    view.rerender(<DiscoverSearch query="" />);

    expect(input).toHaveValue("");
  });

  it("preserves newer typing when a submitted search completes", async () => {
    const user = userEvent.setup();
    const view = render(<DiscoverSearch query="" />);
    const input = screen.getByRole("searchbox");
    await user.type(input, " design {Enter}");
    expect(input).toHaveValue("design");
    await user.type(input, " systems");

    view.rerender(<DiscoverSearch query="design" />);

    expect(input).toHaveValue("design systems");
    expect(input).toHaveFocus();
    // The acknowledgement is consumed; history navigation must sync again.
    view.rerender(<DiscoverSearch query="" />);
    expect(input).toHaveValue("");
  });

  it("returns focus to the input when its clear button disappears", async () => {
    const user = userEvent.setup();
    render(<DiscoverSearch query="design" />);

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it.each(["manual", "button"])(
    "cancels a pending search when cleared by %s before navigation completes",
    async (method) => {
      const user = userEvent.setup();
      const view = render(<DiscoverSearch query="" />);
      const input = screen.getByRole("searchbox");
      await user.type(input, "design{Enter}");
      expect(push).toHaveBeenLastCalledWith("/blog?q=design#blog-results");

      if (method === "manual") await user.clear(input);
      else
        await user.click(screen.getByRole("button", { name: "Clear search" }));

      expect(push).toHaveBeenLastCalledWith("/blog#blog-results");
      // Cancelling keeps the current route; no changed query prop is required.
      view.rerender(<DiscoverSearch query="" />);
      expect(input).toHaveValue("");
      expect(input).toHaveFocus();
    },
  );
});
