import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExitIntent, ExitSession } from "@/lib/authoring-exit-policy";
import type { RecoveryResult } from "@/lib/draft-recovery";
import { NotificationBell } from "./NotificationBell";
import {
  AuthoringExitProvider,
  useAuthoringExit,
  type ExitRegistration,
} from "./AuthoringExitProvider";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => "/create",
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: () => 0,
}));

const emptyBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [{ type: "paragraph", content: [] }],
});
const authoredBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Some writing", styles: {} }],
    },
  ],
});

function session(overrides: Partial<ExitSession> = {}): ExitSession {
  return {
    sessionKey: "draft:d1",
    mode: "draft",
    proposal: { title: "", body: authoredBody, tags: [] },
    baseline: { title: "", body: emptyBody, tags: [] },
    selectedCover: false,
    pendingUploads: 0,
    failedMedia: false,
    saving: false,
    uncertain: false,
    coverRemoved: false,
    ...overrides,
  };
}

const dirtySession = session();
const cleanSession = session({
  baseline: { title: "", body: authoredBody, tags: [] },
});

function makeRegistration(initial: ExitSession = dirtySession) {
  let current = initial;
  const listeners = new Set<() => void>();
  const registration = {
    getSession: () => current,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flushRecovery: vi.fn((): RecoveryResult => ({ ok: true })),
    clearRecovery: vi.fn((): RecoveryResult => ({ ok: true })),
    saveDraft: vi.fn<ExitRegistration["saveDraft"]>(async () => ({
      kind: "saved" as const,
    })),
    validateTarget: vi.fn<ExitRegistration["validateTarget"]>(async () => ({
      ok: true as const,
    })),
    adoptTarget: vi.fn(),
    startFresh: vi.fn(),
    cancelUpdate: vi.fn(),
    reconcile: vi.fn(async () => undefined),
    resumeRecovery: vi.fn(),
    setSession(next: ExitSession) {
      current = next;
      for (const listener of listeners) listener();
    },
  } satisfies ExitRegistration & { setSession: (next: ExitSession) => void };
  return registration;
}

function RegistrationBinder({
  registration,
}: {
  registration: ExitRegistration;
}) {
  const { register } = useAuthoringExit();
  useEffect(() => register(registration), [register, registration]);
  return null;
}

function Trigger({ intent }: { intent: ExitIntent }) {
  const { request } = useAuthoringExit();
  return (
    <button type="button" onClick={() => request(intent)}>
      Trigger exit
    </button>
  );
}

function SignOutTrigger({
  action,
}: {
  action: () => Promise<{ ok: boolean; message?: string }>;
}) {
  const { requestSignOut } = useAuthoringExit();
  return (
    <button type="button" onClick={() => requestSignOut(action)}>
      Trigger sign out
    </button>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderProvider(
  registration: ExitRegistration,
  children?: React.ReactNode,
) {
  return render(
    <AuthoringExitProvider>
      <RegistrationBinder registration={registration} />
      {children}
    </AuthoringExitProvider>,
  );
}

it("guards notification navigation from a published edit and preserves Cancel", async () => {
  const user = userEvent.setup();
  renderProvider(
    makeRegistration(session({ mode: "published-edit" })),
    <NotificationBell />,
  );
  await user.click(screen.getByRole("button", { name: "Notifications" }));
  expect(pushMock).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(pushMock).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Notifications" }));
  await user.click(screen.getByRole("button", { name: "Leave", exact: true }));
  expect(pushMock).toHaveBeenCalledWith("/notifications");
});

it("flushes draft recovery before notification navigation", async () => {
  const registration = makeRegistration();
  registration.flushRecovery.mockImplementation(() => {
    expect(pushMock).not.toHaveBeenCalled();
    return { ok: true };
  });
  renderProvider(registration, <NotificationBell />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Notifications" }));
  expect(registration.flushRecovery).toHaveBeenCalledOnce();
  expect(pushMock).toHaveBeenCalledWith("/notifications");
});

it("blocks notification navigation while a save outcome is uncertain", async () => {
  renderProvider(
    makeRegistration(session({ uncertain: true })),
    <NotificationBell />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Notifications" }));
  expect(pushMock).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Check status" }),
  ).toBeInTheDocument();
});

beforeEach(() => {
  pushMock.mockClear();
});

describe("AuthoringExitProvider", () => {
  it("does not silently leave newer draft writing after an exit save", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    registration.flushRecovery.mockReturnValueOnce({
      ok: false,
      reason: "write-failed",
    });
    renderProvider(
      registration,
      <Trigger intent={{ kind: "navigate", href: "/blog" }} />,
    );
    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    // The session is still dirty after saving an older proposal.
    await user.click(screen.getByRole("button", { name: "Save & leave" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save & leave" }),
      ).toBeEnabled(),
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(registration.flushRecovery).toHaveBeenCalledTimes(1);
  });
  it("does not sign out when recovery abandonment cannot be verified", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    registration.clearRecovery.mockReturnValue({
      ok: false,
      reason: "write-failed",
    });
    const action = vi.fn(async () => ({ ok: true }));
    renderProvider(registration, <SignOutTrigger action={action} />);
    await user.click(screen.getByRole("button", { name: "Trigger sign out" }));
    await user.click(
      screen.getByRole("button", { name: "Discard & sign out" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("recovery copy");
    expect(action).not.toHaveBeenCalled();
    expect(registration.resumeRecovery).toHaveBeenCalled();
  });

  it("signs out when recovery deletion fails but nothing recoverable exists", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(cleanSession);
    registration.clearRecovery.mockReturnValue({
      ok: false,
      reason: "remove-failed",
    });
    const action = vi.fn(async () => ({ ok: true }));
    renderProvider(registration, <SignOutTrigger action={action} />);

    await user.click(screen.getByRole("button", { name: "Trigger sign out" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("switches a published-edit document when recovery deletion fails", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(
      session({ sessionKey: "published-edit:p1", mode: "published-edit" }),
    );
    registration.clearRecovery.mockReturnValue({
      ok: false,
      reason: "remove-failed",
    });
    renderProvider(
      registration,
      <Trigger
        intent={{
          kind: "target",
          href: "/create?draftId=d2",
          target: { editorMode: "draft", id: "d2" },
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Switch" }));

    await waitFor(() =>
      expect(registration.adoptTarget).toHaveBeenCalledWith({
        editorMode: "draft",
        id: "d2",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/create?draftId=d2");
  });

  it("waits for a confirmed save before signing out", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    const save = deferred<{ kind: "saved" }>();
    registration.saveDraft.mockReturnValue(save.promise);
    const action = vi.fn(async () => ({ ok: true }));
    renderProvider(registration, <SignOutTrigger action={action} />);

    await user.click(screen.getByRole("button", { name: "Trigger sign out" }));
    await user.click(screen.getByRole("button", { name: "Save & sign out" }));
    expect(registration.saveDraft).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();

    await act(async () => {
      registration.setSession(cleanSession);
      save.resolve({ kind: "saved" });
    });

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("still refuses a dirty draft switch when recovery deletion cannot be verified", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    registration.clearRecovery.mockReturnValue({
      ok: false,
      reason: "remove-failed",
    });
    renderProvider(
      registration,
      <Trigger
        intent={{
          kind: "target",
          href: "/create?draftId=d2",
          target: { editorMode: "draft", id: "d2" },
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Switch" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("recovery copy");
    expect(registration.adoptTarget).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("resumes recovery and keeps the editor after sign-out fails", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    const action = vi.fn(async () => ({
      ok: false,
      message: "Sign-out connection failed",
    }));
    renderProvider(registration, <SignOutTrigger action={action} />);
    await user.click(screen.getByRole("button", { name: "Trigger sign out" }));
    await user.click(
      screen.getByRole("button", { name: "Discard & sign out" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-out connection failed",
    );
    expect(registration.clearRecovery).toHaveBeenCalledTimes(1);
    expect(registration.resumeRecovery).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("refuses an unavailable target before saving or clearing recovery", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    registration.validateTarget.mockResolvedValue({
      ok: false,
      message: "That document is unavailable.",
    });
    renderProvider(
      registration,
      <Trigger
        intent={{
          kind: "target",
          href: "/create?draftId=missing",
          target: { editorMode: "draft", id: "missing" },
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Save & switch" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That document is unavailable.",
    );
    expect(registration.saveDraft).not.toHaveBeenCalled();
    expect(registration.clearRecovery).not.toHaveBeenCalled();
    expect(registration.adoptTarget).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("switches a clean session to another document without a busy dialog", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(cleanSession);
    const check = deferred<{ ok: true }>();
    registration.validateTarget.mockReturnValue(check.promise);
    renderProvider(
      registration,
      <Trigger
        intent={{
          kind: "target",
          href: "/create?draftId=d2",
          target: { editorMode: "draft", id: "d2" },
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await waitFor(() => expect(registration.validateTarget).toHaveBeenCalled());
    // A switch that loses nothing interrupts nothing while it validates.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await act(async () => check.resolve({ ok: true }));
    await waitFor(() =>
      expect(registration.adoptTarget).toHaveBeenCalledWith({
        editorMode: "draft",
        id: "d2",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/create?draftId=d2");
  });

  it("keeps the switch surface while a confirmed switch validates", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    const check = deferred<{ ok: true }>();
    registration.validateTarget.mockReturnValue(check.promise);
    renderProvider(
      registration,
      <Trigger
        intent={{
          kind: "target",
          href: "/create?draftId=d2",
          target: { editorMode: "draft", id: "d2" },
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Switch" }));
    expect(
      screen.getByRole("alertdialog", { name: "Switch documents?" }),
    ).toBeVisible();

    await act(async () => check.resolve({ ok: true }));
    await waitFor(() =>
      expect(registration.adoptTarget).toHaveBeenCalledWith({
        editorMode: "draft",
        id: "d2",
      }),
    );
  });

  it("validates a target before abandoning recovery and adopting it", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    renderProvider(
      registration,
      <Trigger
        intent={{
          kind: "target",
          href: "/create?draftId=d2",
          target: { editorMode: "draft", id: "d2" },
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Switch" }));
    await waitFor(() => expect(registration.validateTarget).toHaveBeenCalled());
    expect(registration.clearRecovery).toHaveBeenCalledTimes(1);
    expect(registration.adoptTarget).toHaveBeenCalledWith({
      editorMode: "draft",
      id: "d2",
    });
    expect(pushMock).toHaveBeenCalledWith("/create?draftId=d2");
  });

  it("silently writes recovery before continuing app navigation", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    renderProvider(
      registration,
      <Trigger intent={{ kind: "navigate", href: "/blog" }} />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));

    expect(registration.flushRecovery).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/blog");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("lifts a failed recovery write into a storage reminder", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    registration.flushRecovery.mockReturnValue({
      ok: false,
      reason: "write-failed",
    });
    renderProvider(
      registration,
      <Trigger intent={{ kind: "navigate", href: "/blog" }} />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", {
        name: "Your changes aren’t saved",
      }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(pushMock).toHaveBeenCalledWith("/blog");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps one destination across repeated requests", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    renderProvider(
      registration,
      <>
        <Trigger intent={{ kind: "history", key: "k1", href: "/first" }} />
        <Trigger intent={{ kind: "history", key: "k2", href: "/second" }} />
      </>,
    );

    const triggers = screen.getAllByRole("button", { name: "Trigger exit" });
    await user.click(triggers[0]!);
    // Radix marks background content aria-hidden while open; dispatch the
    // repeated request directly, as a second Back press would.
    fireEvent.click(triggers[1]!);
    await user.click(screen.getByRole("button", { name: "Leave" }));

    expect(pushMock).toHaveBeenCalledWith("/first");
    expect(pushMock).not.toHaveBeenCalledWith("/second");
    expect(registration.saveDraft).not.toHaveBeenCalled();
  });

  it("cancels a confirmed navigation without touching the session", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(
      session({
        sessionKey: "published-edit:p1",
        mode: "published-edit",
        proposal: { title: "Edited", body: authoredBody, tags: [] },
      }),
    );
    renderProvider(
      registration,
      <Trigger intent={{ kind: "history", key: "k1", href: "/blog" }} />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(registration.flushRecovery).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("blocks departure while an operation is in flight", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(session({ saving: true }));
    renderProvider(
      registration,
      <Trigger intent={{ kind: "navigate", href: "/blog" }} />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));

    expect(
      screen.getByRole("alertdialog", { name: "Please wait" }),
    ).toBeVisible();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("saves before leaving and re-checks the live session", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(
      session({
        sessionKey: "published-edit:p1",
        mode: "published-edit",
        proposal: { title: "Edited", body: authoredBody, tags: [] },
      }),
    );
    const save = deferred<Awaited<ReturnType<ExitRegistration["saveDraft"]>>>();
    registration.saveDraft.mockReturnValue(save.promise);
    renderProvider(
      registration,
      <Trigger intent={{ kind: "navigate", href: "/dashboard" }} />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(pushMock).not.toHaveBeenCalled();

    registration.setSession(
      session({
        sessionKey: "published-edit:p1",
        mode: "published-edit",
        proposal: { title: "Edited", body: authoredBody, tags: [] },
        baseline: { title: "Edited", body: authoredBody, tags: [] },
      }),
    );
    await act(async () => {
      save.resolve({ kind: "saved" });
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the reminder when newer work appears during the save", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(
      session({
        sessionKey: "published-edit:p1",
        mode: "published-edit",
        proposal: { title: "Edited", body: authoredBody, tags: [] },
      }),
    );
    const save = deferred<Awaited<ReturnType<ExitRegistration["saveDraft"]>>>();
    registration.saveDraft.mockReturnValue(save.promise);
    renderProvider(
      registration,
      <Trigger intent={{ kind: "history", key: "k1", href: "/blog" }} />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));

    registration.setSession(
      session({
        sessionKey: "published-edit:p1",
        mode: "published-edit",
        proposal: { title: "Edited again", body: authoredBody, tags: [] },
      }),
    );
    await act(async () => {
      save.resolve({ kind: "saved" });
    });

    expect(pushMock).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("alertdialog", {
        name: "Leave without saving?",
      }),
    ).toBeVisible();
  });

  it("never navigates after a stale registration resolves", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(
      session({
        sessionKey: "published-edit:p1",
        mode: "published-edit",
        proposal: { title: "Edited", body: authoredBody, tags: [] },
      }),
    );
    const save = deferred<Awaited<ReturnType<ExitRegistration["saveDraft"]>>>();
    registration.saveDraft.mockReturnValue(save.promise);
    const view = renderProvider(
      registration,
      <Trigger intent={{ kind: "navigate", href: "/dashboard" }} />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));
    view.unmount();
    await act(async () => {
      save.resolve({ kind: "saved" });
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the unconfirmed result when a save is indeterminate", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(
      session({
        sessionKey: "published-edit:p1",
        mode: "published-edit",
        proposal: { title: "Edited", body: authoredBody, tags: [] },
      }),
    );
    registration.saveDraft.mockResolvedValue({
      kind: "uncertain",
      message: "The save result could not be confirmed.",
    });
    renderProvider(
      registration,
      <Trigger intent={{ kind: "navigate", href: "/dashboard" }} />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    await user.click(screen.getByRole("button", { name: "Save & leave" }));

    expect(
      await screen.findByRole("alertdialog", {
        name: "We couldn’t confirm your save",
      }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The save result could not be confirmed.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("checks the save status on request without auto-navigating", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration(
      session({
        sessionKey: "published-edit:p1",
        mode: "published-edit",
        proposal: { title: "Edited", body: authoredBody, tags: [] },
        uncertain: true,
      }),
    );
    renderProvider(
      registration,
      <Trigger intent={{ kind: "navigate", href: "/dashboard" }} />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger exit" }));
    registration.setSession(
      session({
        sessionKey: "published-edit:p1",
        mode: "published-edit",
        proposal: { title: "Edited", body: authoredBody, tags: [] },
        baseline: { title: "Edited", body: authoredBody, tags: [] },
      }),
    );
    await user.click(screen.getByRole("button", { name: "Check status" }));

    await waitFor(() =>
      expect(registration.reconcile).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("returns focus to the triggering control after Keep editing", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    renderProvider(
      registration,
      <Trigger intent={{ kind: "history", key: "k1", href: "/blog" }} />,
    );
    const trigger = screen.getByRole("button", { name: "Trigger exit" });
    trigger.focus();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("runs a clean sign out immediately and a dirty one through a strong dialog", async () => {
    const user = userEvent.setup();
    let settleClean!: (result: { ok: boolean }) => void;
    const cleanAction = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          settleClean = resolve;
        }),
    );
    const cleanView = renderProvider(
      makeRegistration(cleanSession),
      <SignOutTrigger action={cleanAction} />,
    );
    await user.click(screen.getByRole("button", { name: "Trigger sign out" }));
    // The request is in flight: a clean session must not show any exit
    // surface while authentication resolves.
    expect(cleanAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await act(async () => {
      settleClean({ ok: true });
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    cleanView.unmount();

    const dirtyAction = vi.fn(async () => ({ ok: true }));
    renderProvider(makeRegistration(), <SignOutTrigger action={dirtyAction} />);
    await user.click(screen.getByRole("button", { name: "Trigger sign out" }));
    expect(dirtyAction).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", {
        name: "Sign out?",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Discard & sign out" }),
    );
    expect(dirtyAction).toHaveBeenCalledTimes(1);
  });
});

describe("AuthoringExitProvider link capture", () => {
  function dispatchClick(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    });
    anchor.dispatchEvent(event);
    return event;
  }

  function renderLinks() {
    const registration = makeRegistration();
    renderProvider(
      registration,
      <div>
        <a href="/profile">Profile</a>
        <a href="https://example.com/page">External</a>
        <a href="#section">Hash</a>
        <a href="/download" download>
          Download
        </a>
        <a href="/new-tab" target="_blank" rel="noreferrer">
          New tab
        </a>
      </div>,
    );
    return registration;
  }

  it("captures plain same-origin app links and recovers before continuing", () => {
    const registration = renderLinks();
    const anchor = screen.getByText("Profile") as HTMLAnchorElement;

    let event!: MouseEvent;
    act(() => {
      event = dispatchClick(anchor);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(registration.flushRecovery).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/profile");
  });

  it("converts /create document links into validated target switches", async () => {
    const user = userEvent.setup();
    const registration = makeRegistration();
    renderProvider(
      registration,
      <div>
        <a href="/create?draftId=d2">Open other draft</a>
        <a href="/create?draftId=d1&from=menu">Same draft with extra params</a>
      </div>,
    );

    await user.click(screen.getByText("Open other draft"));
    expect(
      screen.getByRole("alertdialog", { name: "Switch documents?" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByText("Same draft with extra params"));
    expect(pushMock).toHaveBeenCalledWith("/create?draftId=d1&from=menu");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("leaves external, hash-only, download, new-tab, and modified clicks alone", () => {
    const registration = renderLinks();
    const cases: Array<[string, HTMLAnchorElement, MouseEventInit]> = [
      ["External", screen.getByText("External") as HTMLAnchorElement, {}],
      ["Hash", screen.getByText("Hash") as HTMLAnchorElement, {}],
      ["Download", screen.getByText("Download") as HTMLAnchorElement, {}],
      ["New tab", screen.getByText("New tab") as HTMLAnchorElement, {}],
      [
        "Profile",
        screen.getByText("Profile") as HTMLAnchorElement,
        { metaKey: true },
      ],
      [
        "Profile",
        screen.getByText("Profile") as HTMLAnchorElement,
        { button: 1 },
      ],
    ];

    for (const [, anchor, init] of cases) {
      let event!: MouseEvent;
      act(() => {
        event = dispatchClick(anchor, init);
      });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(registration.flushRecovery).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("ignores clicks when no editor is registered", () => {
    render(
      <AuthoringExitProvider>
        <a href="/profile">Profile</a>
      </AuthoringExitProvider>,
    );
    const anchor = screen.getByText("Profile") as HTMLAnchorElement;

    let event!: MouseEvent;
    act(() => {
      event = dispatchClick(anchor);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("AuthoringExitProvider native warning", () => {
  it("attaches beforeunload only while the session has exit risk", () => {
    const registration = makeRegistration(cleanSession);
    renderProvider(registration);

    const riskEvent = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event;
    };

    expect(riskEvent().defaultPrevented).toBe(false);

    act(() => {
      registration.setSession(dirtySession);
    });
    expect(riskEvent().defaultPrevented).toBe(true);

    act(() => {
      registration.setSession(cleanSession);
    });
    expect(riskEvent().defaultPrevented).toBe(false);

    act(() => {
      registration.setSession(session({ uncertain: true }));
    });
    expect(riskEvent().defaultPrevented).toBe(true);
  });
});

describe("AuthoringExitProvider history traversal", () => {
  function installFakeNavigation() {
    type Listener = (event: unknown) => void;
    const listeners = new Set<Listener>();
    const traversed: string[] = [];
    const interceptCalls: number[] = [];
    (globalThis as { navigation?: unknown }).navigation = {
      addEventListener: (_type: string, listener: Listener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: Listener) => {
        listeners.delete(listener);
      },
      traverseTo: (key: string) => {
        traversed.push(key);
      },
    };
    function emitTraverse(
      key: string,
      overrides: Record<string, unknown> = {},
    ) {
      const event = {
        canIntercept: true,
        cancelable: true,
        hashChange: false,
        downloadRequest: null,
        formData: null,
        navigationType: "traverse",
        destination: {
          key,
          sameDocument: true,
          url: "https://app.local/blog",
        },
        preventDefault: () => {
          interceptCalls.push(1);
        },
        ...overrides,
      };
      for (const listener of listeners) listener(event);
    }
    return {
      traversed,
      interceptCalls,
      emitTraverse,
      dispose: () => {
        delete (globalThis as { navigation?: unknown }).navigation;
      },
    };
  }

  afterEach(() => {
    delete (globalThis as { navigation?: unknown }).navigation;
  });

  it("cancels a traversal, keeps the destination, and replays it once", async () => {
    const user = userEvent.setup();
    const fake = installFakeNavigation();
    const registration = makeRegistration();
    renderProvider(registration);

    act(() => {
      fake.emitTraverse("entry-4");
    });
    expect(fake.interceptCalls).toHaveLength(1);
    expect(
      screen.getByRole("alertdialog", { name: "Leave this page?" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(fake.traversed).toEqual(["entry-4"]);

    // The replay event itself is bypassed without interrupting.
    act(() => {
      fake.emitTraverse("entry-4");
    });
    expect(fake.interceptCalls).toHaveLength(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    // A later traversal of the same entry re-arms the guard.
    act(() => {
      fake.emitTraverse("entry-4");
    });
    expect(fake.interceptCalls).toHaveLength(2);
    expect(
      screen.getByRole("alertdialog", { name: "Leave this page?" }),
    ).toBeVisible();
  });

  it("flushes recovery for a traversal the browser cannot cancel", () => {
    const fake = installFakeNavigation();
    const registration = makeRegistration();
    renderProvider(registration);

    act(() => {
      fake.emitTraverse("entry-9", { cancelable: false });
    });

    expect(registration.flushRecovery).toHaveBeenCalledTimes(1);
    expect(fake.interceptCalls).toHaveLength(0);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("does not touch history when no editor is registered", () => {
    const fake = installFakeNavigation();
    render(
      <AuthoringExitProvider>
        <div />
      </AuthoringExitProvider>,
    );

    act(() => {
      fake.emitTraverse("entry-4");
    });

    expect(fake.interceptCalls).toHaveLength(0);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("flushes recovery on Back/Forward when the Navigation API is unavailable", () => {
    const registration = makeRegistration();
    renderProvider(registration);

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(registration.flushRecovery).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
