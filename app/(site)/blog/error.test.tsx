import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlogError from "./error";

describe("BlogError", () => {
  it("offers an accessible retry action for Discover failures", async () => {
    const reset = vi.fn();
    render(<BlogError error={new Error("network failure")} reset={reset} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /could not load the blog/i,
    );
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
