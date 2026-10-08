import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ExitDecision } from "@/lib/authoring-exit-policy";
import { AuthoringExitDialog } from "./AuthoringExitDialog";

const confirm = (
  risk: Extract<ExitDecision, { kind: "confirm" }>["risk"],
  level: "light" | "strong" | "switch" = risk === "sign-out"
    ? "strong"
    : risk === "abandon"
      ? "switch"
      : "light",
  canSaveDraft = true,
): ExitDecision => ({ kind: "confirm", level, risk, canSaveDraft });

function renderDialog(
  decision: ExitDecision,
  overrides: Partial<{
    pending: boolean;
    error: string | null;
    onStay: () => void;
    onLeave: () => void;
    onSave: () => void;
    onReconcile: () => void;
  }> = {},
) {
  const onStay = overrides.onStay ?? vi.fn();
  const onLeave = overrides.onLeave ?? vi.fn();
  const onSave = overrides.onSave ?? vi.fn();
  render(
    <AuthoringExitDialog
      open
      decision={decision}
      pending={overrides.pending ?? false}
      error={overrides.error ?? null}
      onStay={onStay}
      onLeave={onLeave}
      onSave={onSave}
      onReconcile={overrides.onReconcile}
    />,
  );
  return { onStay, onLeave, onSave };
}

describe("AuthoringExitDialog", () => {
  it("renders a light unsaved-work reminder with all three choices", async () => {
    const user = userEvent.setup();
    const { onStay, onLeave, onSave } = renderDialog(confirm("unsaved"));

    expect(
      screen.getByRole("alertdialog", { name: "Leave this page?" }),
    ).toBeVisible();
    expect(
      screen.getByText("Save a draft to keep your latest changes."),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onStay).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Save & leave" }));
    expect(onSave).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("treats Escape as Keep editing", async () => {
    const user = userEvent.setup();
    const { onStay, onLeave } = renderDialog(confirm("published-edit"));

    await user.keyboard("{Escape}");

    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("explains the published-edit loss without recovery language", () => {
    renderDialog(confirm("published-edit"));
    expect(
      screen.getByRole("alertdialog", {
        name: "Leave without saving?",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Your changes will be lost. Your published post won’t change.",
      ),
    ).toBeVisible();
  });

  it("states the cover risk precisely", () => {
    renderDialog(confirm("cover"));
    expect(
      screen.getByText("Your image changes may be lost. Save before leaving."),
    ).toBeVisible();
  });

  it("reports a failed recovery write without promising recovery", () => {
    renderDialog(confirm("storage"));
    expect(
      screen.getByRole("alertdialog", {
        name: "Your changes aren’t saved",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Save a draft before leaving to avoid losing your work.",
      ),
    ).toBeVisible();
  });

  it("uses stronger sign-out wording and a destructive leave action", async () => {
    const user = userEvent.setup();
    const { onLeave, onSave } = renderDialog(confirm("sign-out", "strong"));

    expect(
      screen.getByRole("alertdialog", {
        name: "Sign out?",
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Discard & sign out" }),
    );
    await user.click(screen.getByRole("button", { name: "Save & sign out" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("offers Switch for document switches", async () => {
    const user = userEvent.setup();
    const { onLeave } = renderDialog(confirm("abandon", "switch"));
    expect(
      screen.getByRole("alertdialog", { name: "Switch documents?" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Switch" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("never offers a draft-save shortcut for explicit abandonment", () => {
    renderDialog(confirm("abandon", "switch", false));
    expect(
      screen.queryByRole("button", { name: /Save &/ }),
    ).not.toBeInTheDocument();
  });

  it("blocks departure while an operation is in flight", () => {
    renderDialog({ kind: "block", reason: "operation" });
    expect(
      screen.getByRole("alertdialog", { name: "Please wait" }),
    ).toBeVisible();
    expect(
      screen.getByText("Your save or upload is still in progress."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Stay here" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Leave" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Save &/ }),
    ).not.toBeInTheDocument();
  });

  it("offers a status check for an uncertain save", async () => {
    const user = userEvent.setup();
    const onReconcile = vi.fn();
    renderDialog({ kind: "block", reason: "uncertain" }, { onReconcile });

    expect(
      screen.getByRole("alertdialog", {
        name: "We couldn’t confirm your save",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Check status" }));
    expect(onReconcile).toHaveBeenCalledTimes(1);
  });

  it("disables every action and prevents Escape while pending", async () => {
    const user = userEvent.setup();
    const { onStay, onLeave, onSave } = renderDialog(confirm("unsaved"), {
      pending: true,
    });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Leave" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onStay).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows a save failure as an alert and keeps the choices available", async () => {
    const user = userEvent.setup();
    const { onLeave } = renderDialog(confirm("unsaved"), {
      error: "The draft could not be saved.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The draft could not be saved.",
    );
    expect(screen.getByRole("button", { name: "Leave" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while closed", () => {
    render(
      <AuthoringExitDialog
        open={false}
        decision={confirm("unsaved")}
        pending={false}
        error={null}
        onStay={vi.fn()}
        onLeave={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
