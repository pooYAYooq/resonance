// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDraftRecovery,
  draftRecoveryStorageKey,
  readDraftRecovery,
  saveDraftRecovery,
} from "./draft-recovery";

const proposal = {
  title: "Draft title",
  body: JSON.stringify({ format: "blocknote@1", blocks: [] }),
  tags: ["one", "two"],
};

afterEach(() => {
  vi.restoreAllMocks();
  try {
    window.localStorage.clear();
  } catch {
    // The storage-unavailable test may leave a throwing getter in place.
  }
});

describe("draft recovery storage", () => {
  it("round trips a proposal for a session key", () => {
    saveDraftRecovery("new:new", proposal, 1234);

    const snapshot = readDraftRecovery("new:new");
    expect(snapshot?.savedAt).toBe(1234);
    expect(snapshot?.proposal).toEqual(proposal);
  });

  it("isolates snapshots by session key", () => {
    saveDraftRecovery("draft:abc", proposal, 1);

    expect(readDraftRecovery("draft:abc")?.proposal.title).toBe("Draft title");
    expect(readDraftRecovery("draft:def")).toBeNull();
  });

  it("clears a stored snapshot", () => {
    saveDraftRecovery("new:new", proposal);

    clearDraftRecovery("new:new");

    expect(readDraftRecovery("new:new")).toBeNull();
    expect(
      window.localStorage.getItem(draftRecoveryStorageKey("new:new")),
    ).toBeNull();
  });

  it("rejects a snapshot with an unknown version", () => {
    window.localStorage.setItem(
      draftRecoveryStorageKey("new:new"),
      JSON.stringify({
        version: 999,
        savedAt: 1,
        sessionKey: "new:new",
        proposal,
      }),
    );

    expect(readDraftRecovery("new:new")).toBeNull();
  });

  it("rejects malformed or incomplete snapshots", () => {
    window.localStorage.setItem(draftRecoveryStorageKey("new:new"), "not json");
    expect(readDraftRecovery("new:new")).toBeNull();

    window.localStorage.setItem(
      draftRecoveryStorageKey("new:new"),
      JSON.stringify({
        version: 1,
        savedAt: 1,
        sessionKey: "new:new",
        proposal: { title: 1 },
      }),
    );
    expect(readDraftRecovery("new:new")).toBeNull();
  });

  it("is inert when storage is unavailable", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(() => saveDraftRecovery("new:new", proposal)).not.toThrow();
    expect(readDraftRecovery("new:new")).toBeNull();
    expect(() => clearDraftRecovery("new:new")).not.toThrow();
  });
});
