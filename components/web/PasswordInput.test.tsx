import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
  it("toggles visibility and exposes the current state", async () => {
    const user = userEvent.setup();
    render(
      <PasswordInput
        id="password"
        aria-label="Password"
        defaultValue="password123"
      />,
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    const show = screen.getByRole("button", { name: "Show password" });
    expect(show).toHaveAttribute("aria-pressed", "false");
    expect(show).toHaveAttribute("aria-controls", "password");

    await user.click(show);

    expect(input).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    await user.click(hide);

    expect(input).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toBeInTheDocument();
  });

  it("does not submit a surrounding form when toggled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Password" />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the toggle with the input", () => {
    render(<PasswordInput aria-label="Password" disabled />);

    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toBeDisabled();
  });
});
