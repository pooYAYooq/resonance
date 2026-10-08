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
  vi.restoreAllMocks();
});

describe("useDraftRecovery", () => {
  it("never persists published edits and clears an existing recovery snapshot", () => {
    const sessionKey = "published-edit:post-1";
    saveDraftRecovery(sessionKey, proposal, 1);
    renderHook(() =>
      useDraftRecovery({ sessionKey, ready: true, dirty: true, proposal }),
    );
    act(() => {
      vi.advanceTimersByTime(DRAFT_RECOVERY_DEBOUNCE_MS * 2);
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(readDraftRecovery(sessionKey)).toBeNull();
  });
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

  it("clears the abandoned session's snapshot when the key changes", () => {
    saveDraftRecovery("new:new", proposal, 1);

    const { rerender } = renderHook(
      ({ sessionKey }: { sessionKey: string }) =>
        useDraftRecovery({
          sessionKey,
          ready: true,
          dirty: true,
          proposal,
        }),
      { initialProps: { sessionKey: "new:new" } },
    );

    expect(readDraftRecovery("new:new")).not.toBeNull();

    rerender({ sessionKey: "draft:1" });

    expect(readDraftRecovery("new:new")).toBeNull();
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

  it("flushes the most recent edit before the debounce runs", () => {
    const { result, rerender } = renderHook(
      ({ title }: { title: string }) =>
        useDraftRecovery({
          sessionKey: "new:new",
          ready: true,
          dirty: true,
          proposal: { ...proposal, title },
        }),
      { initialProps: { title: "Previous" } },
    );
    rerender({ title: "Latest keystroke" });
    expect(result.current.flush()).toEqual({ ok: true });
    expect(readDraftRecovery("new:new")?.proposal.title).toBe(
      "Latest keystroke",
    );
  });

  it("does not recreate abandoned recovery on debounce or pagehide", () => {
    saveDraftRecovery("new:new", proposal);
    const { result } = renderHook(() =>
      useDraftRecovery({
        sessionKey: "new:new",
        ready: true,
        dirty: true,
        proposal,
      }),
    );
    expect(result.current.abandon()).toEqual({ ok: true });
    act(() => {
      vi.advanceTimersByTime(DRAFT_RECOVERY_DEBOUNCE_MS * 2);
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(readDraftRecovery("new:new")).toBeNull();
  });

  it("can resume the same session after cancelling abandonment", () => {
    const { result } = renderHook(() =>
      useDraftRecovery({
        sessionKey: "new:new",
        ready: true,
        dirty: true,
        proposal,
      }),
    );
    result.current.abandon();
    result.current.resume();
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(readDraftRecovery("new:new")?.proposal).toEqual(proposal);
  });

  it("returns deletion failure and resumes recovery instead of losing writing", () => {
    const { result } = renderHook(() =>
      useDraftRecovery({
        sessionKey: "draft:one",
        ready: true,
        dirty: true,
        proposal,
      }),
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("remove denied");
    });
    expect(result.current.abandon()).toEqual({
      ok: false,
      reason: "remove-failed",
    });
    result.current.resume();
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(readDraftRecovery("draft:one")?.proposal).toEqual(proposal);
  });

  it("resumes a fresh session without restoring the abandoned session", () => {
    const { result, rerender } = renderHook(
      ({ sessionKey }: { sessionKey: string }) =>
        useDraftRecovery({ sessionKey, ready: true, dirty: true, proposal }),
      { initialProps: { sessionKey: "draft:one" } },
    );
    result.current.abandon();
    rerender({ sessionKey: "new:new" });
    act(() => vi.advanceTimersByTime(DRAFT_RECOVERY_DEBOUNCE_MS));
    expect(readDraftRecovery("draft:one")).toBeNull();
    expect(readDraftRecovery("new:new")?.proposal).toEqual(proposal);
  });

  it("writes recovery again after returning to a previously abandoned session", () => {
    const { result, rerender } = renderHook(
      ({ sessionKey }: { sessionKey: string }) =>
        useDraftRecovery({ sessionKey, ready: true, dirty: true, proposal }),
      { initialProps: { sessionKey: "draft:one" } },
    );

    expect(result.current.abandon()).toEqual({ ok: true });

    rerender({ sessionKey: "draft:two" });
    rerender({ sessionKey: "draft:one" });

    act(() => {
      expect(result.current.flush()).toEqual({ ok: true });
    });
    expect(readDraftRecovery("draft:one")?.proposal).toEqual(proposal);
  });

  it("treats abandonment of a published-edit session as nothing to clear", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("remove denied");
    });
    const { result } = renderHook(() =>
      useDraftRecovery({
        sessionKey: "published-edit:post-1",
        ready: true,
        dirty: true,
        proposal,
      }),
    );

    expect(result.current.abandon()).toEqual({ ok: true });
  });
});
