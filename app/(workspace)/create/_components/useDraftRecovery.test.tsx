import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readDraftRecovery, saveDraftRecovery } from "@/lib/draft-recovery";
import {
  DRAFT_RECOVERY_DEBOUNCE_MS,
  useDraftRecovery,
} from "./useDraftRecovery";

const proposal = {
  title: "Draft title",
  body: JSON.stringify({ format: "blocknote@1", blocks: [] }),
  tags: ["a"],
};

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDraftRecovery", () => {
  it("writes a dirty proposal only after the debounce", () => {
    renderHook(() =>
      useDraftRecovery({
        sessionKey: "new:new",
        ready: true,
        dirty: true,
        proposal,
      }),
    );

    expect(readDraftRecovery("new:new")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(DRAFT_RECOVERY_DEBOUNCE_MS);
    });

    expect(readDraftRecovery("new:new")?.proposal).toEqual(proposal);
  });

  it("does not write while the session is clean", () => {
    renderHook(() =>
      useDraftRecovery({
        sessionKey: "new:new",
        ready: true,
        dirty: false,
        proposal,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(DRAFT_RECOVERY_DEBOUNCE_MS * 2);
    });

    expect(readDraftRecovery("new:new")).toBeNull();
  });

  it("clears the snapshot whenever a dirty session becomes clean", () => {
    saveDraftRecovery("draft:1", proposal, 1);

    const { rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) =>
        useDraftRecovery({
          sessionKey: "draft:1",
          ready: true,
          dirty,
          proposal,
        }),
      { initialProps: { dirty: true } },
    );

    expect(readDraftRecovery("draft:1")).not.toBeNull();

    rerender({ dirty: false });

    expect(readDraftRecovery("draft:1")).toBeNull();
  });

  it("does not clear the snapshot on the initial clean hydration", () => {
    saveDraftRecovery("draft:1", proposal, 1);

    renderHook(() =>
      useDraftRecovery({
        sessionKey: "draft:1",
        ready: true,
        dirty: false,
        proposal,
      }),
    );

    expect(readDraftRecovery("draft:1")).not.toBeNull();
  });

  it("flushes the latest proposal on pagehide while dirty", () => {
    renderHook(() =>
      useDraftRecovery({
        sessionKey: "new:new",
        ready: true,
        dirty: true,
        proposal,
      }),
    );

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(readDraftRecovery("new:new")?.proposal).toEqual(proposal);
  });
});
