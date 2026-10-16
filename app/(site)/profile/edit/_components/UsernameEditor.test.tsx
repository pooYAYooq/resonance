import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsernameEditor } from "./UsernameEditor";

const {
  claimUsernameMock,
  availabilityMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  claimUsernameMock: vi.fn(),
  availabilityMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => claimUsernameMock,
  useQuery: (_query: unknown, args: unknown) =>
    args === "skip" ? undefined : availabilityMock(args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    usernames: {
      claimUsername: "claimUsername",
      checkUsernameAvailability: "checkUsernameAvailability",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const SAVED_USERNAME = "pooya";

// The real query reports the account's own saved name as `current`; a stub
// that returned `available` for it would make the "taken" test pass for the
// wrong reason.
function availabilityFor(username: string) {
  return username.toLowerCase() === SAVED_USERNAME
    ? { status: "current" as const }
    : { status: "available" as const };
}

const baseProps = {
  userId: "auth-user-1",
  initialUsername: SAVED_USERNAME,
  revision: 3,
  newClaimAllowed: true,
  newClaimRetryAfterMs: 0,
};

describe("UsernameEditor", () => {
  beforeEach(() => {
    claimUsernameMock.mockReset();
    availabilityMock.mockReset();
    availabilityMock.mockImplementation((args: { username: string }) =>
      availabilityFor(args.username),
    );
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("explains a format error immediately without calling the save mutation", async () => {
    const user = userEvent.setup();
    render(<UsernameEditor {...baseProps} />);

    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "pooya-k");

    expect(
      await screen.findByText(
        "Use only English letters, numbers, and underscores.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save username" }),
    ).toBeDisabled();
    expect(claimUsernameMock).not.toHaveBeenCalled();
  });

  it("shows the eligibility date once the allowance is spent", () => {
    render(
      <UsernameEditor
        {...baseProps}
        newClaimAllowed={false}
        newClaimRetryAfterMs={78 * 24 * 60 * 60 * 1000}
      />,
    );
    expect(
      screen.getByText(
        /You can claim a new username after your 90-day wait ends/,
      ),
    ).toBeInTheDocument();
    // The date includes a time so it does not imply eligibility at midnight.
    expect(
      screen.getByText(/after your 90-day wait ends on .*20\d{2}/),
    ).toBeInTheDocument();
  });

  it("reports a free new name as available but not yet claimable", async () => {
    const user = userEvent.setup();
    render(
      <UsernameEditor
        {...baseProps}
        newClaimAllowed={false}
        newClaimRetryAfterMs={1}
      />,
    );

    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "someoneelse");

    expect(
      await screen.findByText(
        "Available, but you cannot claim a new name yet.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save username" }),
    ).toBeDisabled();
  });

  it("saves a capitalization-only change without a confirmation dialog", async () => {
    const user = userEvent.setup();
    claimUsernameMock.mockResolvedValue({
      kind: "saved",
      username: "Pooya",
      revision: 4,
    });
    render(<UsernameEditor {...baseProps} />);

    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "Pooya");
    await user.click(screen.getByRole("button", { name: "Save username" }));

    await waitFor(() =>
      expect(claimUsernameMock).toHaveBeenCalledWith({
        username: "Pooya",
        expectedRevision: 3,
      }),
    );
    expect(screen.queryByText("Change your username?")).toBeNull();
  });

  it.each([true, false])(
    "saves case-only edits immediately without lookup when newClaimAllowed=%s",
    async (newClaimAllowed) => {
      vi.useFakeTimers();
      availabilityMock.mockReturnValue(undefined);
      claimUsernameMock.mockResolvedValue({
        kind: "saved",
        username: "Pooya",
        revision: 4,
      });
      render(
        <UsernameEditor {...baseProps} newClaimAllowed={newClaimAllowed} />,
      );

      fireEvent.change(screen.getByLabelText("Username"), {
        target: { value: "Pooya" },
      });
      expect(
        screen.getByRole("button", { name: "Save username" }),
      ).toBeEnabled();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save username" }));
      });

      expect(claimUsernameMock).toHaveBeenCalledWith({
        username: "Pooya",
        expectedRevision: 3,
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Username")).toHaveValue("Pooya");
    },
  );

  it.each([true, false])(
    "waits for the current target during debounce before confirming an owned name when newClaimAllowed=%s",
    async (newClaimAllowed) => {
      vi.useFakeTimers();
      availabilityMock.mockImplementation(
        ({ username }: { username: string }) =>
          username === "oldname" ? { status: "owned" } : { status: "current" },
      );
      claimUsernameMock.mockResolvedValue({
        kind: "saved",
        username: "oldname",
        revision: 4,
      });
      render(
        <UsernameEditor {...baseProps} newClaimAllowed={newClaimAllowed} />,
      );

      fireEvent.change(screen.getByLabelText("Username"), {
        target: { value: "oldname" },
      });
      expect(screen.getByText("Checking availability...")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Save username" }),
      ).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Save username" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(claimUsernameMock).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(350));
      expect(
        screen.getByText("This is one of your previous usernames."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Save username" }),
      ).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "Save username" }));
      expect(screen.getByRole("dialog")).toHaveTextContent("pooya to oldname");
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "does not change your 90-day wait",
      );
      expect(screen.getByRole("dialog")).not.toHaveTextContent(
        "90-day wait before you can claim another",
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      });
      expect(claimUsernameMock).toHaveBeenCalledWith({
        username: "oldname",
        expectedRevision: 3,
      });
      expect(screen.getByLabelText("Username")).toHaveValue("oldname");
    },
  );

  it.each([true, false])(
    "waits for an unresolved query after debounce before confirming when newClaimAllowed=%s",
    (newClaimAllowed) => {
      vi.useFakeTimers();
      let resolved = false;
      availabilityMock.mockImplementation(
        ({ username }: { username: string }) =>
          username === "oldname"
            ? resolved
              ? { status: "owned" }
              : undefined
            : { status: "current" },
      );
      const { rerender } = render(
        <UsernameEditor {...baseProps} newClaimAllowed={newClaimAllowed} />,
      );
      fireEvent.change(screen.getByLabelText("Username"), {
        target: { value: "oldname" },
      });
      act(() => vi.advanceTimersByTime(350));

      expect(screen.getByText("Checking availability...")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Save username" }),
      ).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Save username" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(claimUsernameMock).not.toHaveBeenCalled();

      resolved = true;
      rerender(
        <UsernameEditor {...baseProps} newClaimAllowed={newClaimAllowed} />,
      );
      expect(
        screen.getByRole("button", { name: "Save username" }),
      ).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "Save username" }));
      expect(screen.getByRole("dialog")).toHaveTextContent("pooya to oldname");
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "does not change your 90-day wait",
      );
    },
  );

  it.each(["owned", "available"] as const)(
    "keeps the confirmed target and %s classification stable when availability updates",
    async (initialStatus) => {
      vi.useFakeTimers();
      let targetStatus: "owned" | "available" = initialStatus;
      availabilityMock.mockImplementation(
        ({ username }: { username: string }) =>
          username === "candidate"
            ? { status: targetStatus }
            : { status: "current" },
      );
      claimUsernameMock.mockResolvedValue({
        kind: "saved",
        username: "candidate",
        revision: 4,
      });
      const { rerender } = render(<UsernameEditor {...baseProps} />);
      fireEvent.change(screen.getByLabelText("Username"), {
        target: { value: "candidate" },
      });
      act(() => vi.advanceTimersByTime(350));
      fireEvent.click(screen.getByRole("button", { name: "Save username" }));

      targetStatus = initialStatus === "owned" ? "available" : "owned";
      rerender(<UsernameEditor {...baseProps} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("pooya to candidate");
      expect(dialog).toHaveTextContent(
        initialStatus === "owned"
          ? "does not change your 90-day wait"
          : "90-day wait before you can claim another",
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      });
      expect(claimUsernameMock).toHaveBeenCalledWith({
        username: "candidate",
        expectedRevision: 3,
      });
      expect(screen.getByLabelText("Username")).toHaveValue("candidate");
    },
  );

  it("confirms a new claim before consuming the allowance", async () => {
    const user = userEvent.setup();
    claimUsernameMock.mockResolvedValue({
      kind: "saved",
      username: "newchoice",
      revision: 4,
    });
    render(<UsernameEditor {...baseProps} />);

    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "newchoice");
    await screen.findByText("Available.");
    await user.click(screen.getByRole("button", { name: "Save username" }));

    expect(
      await screen.findByText("Change your username?"),
    ).toBeInTheDocument();
    expect(claimUsernameMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(claimUsernameMock).toHaveBeenCalledWith({
        username: "newchoice",
        expectedRevision: 3,
      }),
    );
  });

  it("adopts the saved spelling after a confirmed claim", async () => {
    const user = userEvent.setup();
    claimUsernameMock.mockResolvedValue({
      kind: "saved",
      username: "NewChoice",
      revision: 4,
    });
    render(<UsernameEditor {...baseProps} />);

    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "newchoice");
    await screen.findByText("Available.");
    await user.click(screen.getByRole("button", { name: "Save username" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("Username updated"),
    );
    expect(screen.getByLabelText("Username")).toHaveValue("NewChoice");
  });

  it("reports a name taken between checking and saving neutrally", async () => {
    const user = userEvent.setup();
    availabilityMock.mockImplementation((args: { username: string }) =>
      args.username.toLowerCase() === SAVED_USERNAME
        ? { status: "current" as const }
        : { status: "taken" as const },
    );
    render(<UsernameEditor {...baseProps} />);

    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "someoneelse");

    expect(
      await screen.findByText("Username unavailable."),
    ).toBeInTheDocument();
    expect(claimUsernameMock).not.toHaveBeenCalled();
  });

  it("preserves the draft and reports the neutral message when the save loses the race", async () => {
    const user = userEvent.setup();
    claimUsernameMock.mockResolvedValue({ kind: "unavailable" });
    render(<UsernameEditor {...baseProps} />);

    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "newchoice");
    await screen.findByText("Available.");
    await user.click(screen.getByRole("button", { name: "Save username" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(claimUsernameMock).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Username unavailable."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("newchoice");
  });

  it("surfaces a conflict without losing the typed draft", async () => {
    const user = userEvent.setup();
    claimUsernameMock.mockResolvedValue({ kind: "conflict" });
    render(<UsernameEditor {...baseProps} />);

    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "newchoice");
    await screen.findByText("Available.");
    await user.click(screen.getByRole("button", { name: "Save username" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));

    expect(
      await screen.findByText(/Another change saved first/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("newchoice");
  });

  it("disables saving when the draft equals the saved username", () => {
    render(<UsernameEditor {...baseProps} />);

    expect(
      screen.getByRole("button", { name: "Save username" }),
    ).toBeDisabled();
  });

  it("does not apply a lagging availability result to the current draft", async () => {
    render(<UsernameEditor {...baseProps} />);
    const input = screen.getByLabelText("Username");

    fireEvent.change(input, { target: { value: "othername" } });

    // The debounce has not caught up, so the result for the saved name is
    // stale and must not be shown for the new draft.
    expect(screen.getByText("Checking availability...")).toBeInTheDocument();
    expect(screen.queryByText("This is your current username.")).toBeNull();

    // Once the debounced value catches up, the new result applies.
    expect(await screen.findByText("Available.")).toBeInTheDocument();
  });

  it("adopts a newer saved username when the draft is clean", () => {
    const { rerender } = render(<UsernameEditor {...baseProps} />);
    expect(screen.getByLabelText("Username")).toHaveValue("pooya");

    rerender(
      <UsernameEditor {...baseProps} initialUsername="newname" revision={4} />,
    );

    expect(screen.getByLabelText("Username")).toHaveValue("newname");
    expect(
      screen.queryByRole("button", { name: "Load saved username" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Save username" }),
    ).toBeDisabled();
  });

  it("keeps a dirty draft and offers reload when the saved username changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<UsernameEditor {...baseProps} />);
    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "mynew");

    rerender(
      <UsernameEditor {...baseProps} initialUsername="newname" revision={4} />,
    );

    expect(screen.getByLabelText("Username")).toHaveValue("mynew");
    expect(
      screen.getByRole("button", { name: "Load saved username" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Another change saved first/)).toBeInTheDocument();
  });

  it("adopts the new saved value when the reload action is used", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<UsernameEditor {...baseProps} />);
    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "mynew");
    rerender(
      <UsernameEditor {...baseProps} initialUsername="newname" revision={4} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Load saved username" }),
    );

    expect(screen.getByLabelText("Username")).toHaveValue("newname");
    expect(
      screen.queryByRole("button", { name: "Load saved username" }),
    ).toBeNull();
  });

  it("shows the exact old and new names with the new-claim notice", async () => {
    const user = userEvent.setup();
    render(<UsernameEditor {...baseProps} />);
    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "newchoice");
    await screen.findByText("Available.");
    await user.click(screen.getByRole("button", { name: "Save username" }));

    expect(await screen.findByText("pooya to newchoice")).toBeInTheDocument();
    expect(
      screen.getByText(/90-day wait before you can claim another/),
    ).toBeInTheDocument();
  });

  it("distinguishes switching to a previous name from a new claim", async () => {
    const user = userEvent.setup();
    availabilityMock.mockImplementation((args: { username: string }) =>
      args.username.toLowerCase() === SAVED_USERNAME
        ? { status: "current" as const }
        : { status: "owned" as const },
    );
    render(<UsernameEditor {...baseProps} />);
    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "oldname");
    expect(
      await screen.findByText("This is one of your previous usernames."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save username" }));

    expect(await screen.findByText("pooya to oldname")).toBeInTheDocument();
    expect(
      screen.getByText(/does not change your 90-day wait/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/90-day wait before you can claim another/),
    ).toBeNull();
  });
});
