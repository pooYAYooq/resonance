import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DeleteAllNotificationsDialog } from "./DeleteAllNotificationsDialog";

const counts = {
  total: 42,
  read: 36,
  unread: 6,
  truncated: false,
};

function renderDialog(
  overrides: Partial<ComponentProps<typeof DeleteAllNotificationsDialog>> = {},
) {
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  const view = render(
    <DeleteAllNotificationsDialog
      open
      counts={counts}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { ...view, onConfirm, onOpenChange };
}

describe("DeleteAllNotificationsDialog", () => {
  it("renders the harnessed counts with Read only selected", () => {
    renderDialog();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Read only/ })).toBeChecked();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("36")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("defaults to Unread only when no rows are read", () => {
    renderDialog({
      counts: {
        total: 6,
        read: 0,
        unread: 6,
        truncated: false,
      },
    });

    expect(screen.getByRole("radio", { name: /Unread only/ })).toBeChecked();
    expect(
      screen.queryByRole("radio", { name: /Read only/ }),
    ).not.toBeInTheDocument();
  });

  it("uses a roving tabindex for the scope radios", () => {
    renderDialog();

    expect(screen.getByRole("radio", { name: /Read only/ })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("radio", { name: /All/ })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(screen.getByRole("radio", { name: /Unread only/ })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("confirms the Read only scope", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledWith("read");
  });

  it("passes the unread scope when selected", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(screen.getByRole("radio", { name: /Unread only/ }));
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toBeInTheDocument();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("unread");
  });

  it("shows 1000+ when the counts are truncated", () => {
    renderDialog({
      counts: {
        total: 1000,
        read: 900,
        unread: 100,
        truncated: true,
      },
    });

    expect(screen.getByText("1000+")).toBeInTheDocument();
    expect(screen.getByText("900+")).toBeInTheDocument();
    expect(screen.getByText("100+")).toBeInTheDocument();
  });
});
