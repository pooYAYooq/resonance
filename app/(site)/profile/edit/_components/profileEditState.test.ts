import { describe, expect, it } from "vitest";
import {
  initialEditState,
  isDirty,
  markConflict,
  moveSelected,
  receiveSaved,
  reconcileSaved,
  cacheSelectedCards,
} from "./profileEditState";

type Draft = { bio: string };

const equalBio = (a: Draft, b: Draft) => a.bio === b.bio;

describe("profileEditState", () => {
  it("retains only selected cards instead of historical search results", () => {
    const alpha = { postId: "alpha", title: "Alpha" };
    const previous = { alpha, old: { postId: "old", title: "Old search" } };
    const results = Array.from({ length: 100 }, (_, index) => ({
      postId: `result-${index}`,
      title: `Result ${index}`,
    }));
    expect(cacheSelectedCards(previous, ["alpha"], results)).toEqual({ alpha });
    expect(Object.keys(previous)).toEqual(["alpha", "old"]);
  });

  it("keeps nine selected cards while cycling through unrelated searches", () => {
    const selected = Array.from({ length: 9 }, (_, index) => ({
      postId: `selected-${index}`,
      title: `Selected ${index}`,
    }));
    const ids = selected.map((entry) => entry.postId);
    let cache = Object.fromEntries(
      selected.map((entry) => [entry.postId, entry]),
    );
    for (let index = 0; index < 100; index++) {
      cache = cacheSelectedCards(cache, ids, [
        { postId: `search-${index}`, title: "Unselected" },
      ]);
      expect(Object.keys(cache)).toHaveLength(9);
    }
    expect(Object.keys(cache)).toEqual(ids);
  });

  it("evicts removed cards and clears the cache when the selection is empty", () => {
    const alpha = { postId: "alpha", title: "Alpha" };
    const beta = { postId: "beta", title: "Beta" };
    const remaining = cacheSelectedCards(
      { alpha, beta },
      ["beta"],
      [alpha, beta],
    );
    expect(remaining).toEqual({ beta });
    expect(cacheSelectedCards(remaining, [], [alpha, beta])).toEqual({});
  });

  it("refreshes selected card details without mutating the previous cache", () => {
    const alpha = { postId: "alpha", title: "Alpha" };
    const updated = { postId: "alpha", title: "Updated Alpha" };
    const previous = { alpha };
    expect(cacheSelectedCards(previous, ["alpha"], [updated])).toEqual({
      alpha: updated,
    });
    expect(previous.alpha.title).toBe("Alpha");
  });

  it("reuses an unchanged selected-card cache", () => {
    const alpha = { postId: "alpha", title: "Alpha" };
    const previous = { alpha };
    expect(cacheSelectedCards(previous, ["alpha"], [alpha])).toBe(previous);
  });
  it("initializes value and baseline from the saved record without conflict", () => {
    const state = initialEditState<Draft>({ bio: "Saved" }, 3);

    expect(state).toEqual({
      value: { bio: "Saved" },
      baseline: { bio: "Saved" },
      revision: 3,
      conflict: false,
    });
    expect(isDirty(state, equalBio)).toBe(false);
  });

  it("treats newer typing as dirty until saved", () => {
    const state = {
      value: { bio: "Newer typing" },
      baseline: { bio: "Old" },
      revision: 0,
      conflict: false,
    };

    expect(isDirty(state, equalBio)).toBe(true);
  });

  it("reconciles a successful save to the submitted snapshot, preserving newer typing", () => {
    const state = {
      value: { bio: "Newer typing" },
      baseline: { bio: "Old" },
      revision: 0,
      conflict: false,
    };

    const next = reconcileSaved(state, { bio: "Submitted" }, 1);

    expect(next).toEqual({
      ...state,
      baseline: { bio: "Submitted" },
      revision: 1,
    });
    expect(next.value.bio).toBe("Newer typing");
    expect(isDirty(next, equalBio)).toBe(true);
  });

  it("adopts a newer saved value from another revision only when the form is clean", () => {
    const clean = {
      value: { bio: "Same" },
      baseline: { bio: "Same" },
      revision: 0,
      conflict: false,
    };

    const next = receiveSaved(clean, { bio: "Another session" }, 1, equalBio);

    expect(next).toEqual({
      value: { bio: "Another session" },
      baseline: { bio: "Another session" },
      revision: 1,
      conflict: false,
    });
  });

  it("flags a conflict and keeps unsaved input when a dirty form sees another revision", () => {
    const state = {
      value: { bio: "Newer typing" },
      baseline: { bio: "Old" },
      revision: 0,
      conflict: false,
    };

    const next = receiveSaved(state, { bio: "Another session" }, 1, equalBio);

    expect(next.value.bio).toBe("Newer typing");
    expect(next.conflict).toBe(true);
    expect(next.revision).toBe(0);
    expect(next.baseline.bio).toBe("Old");
  });

  it("ignores a query echo at the same revision", () => {
    const state = {
      value: { bio: "Typing" },
      baseline: { bio: "Typing" },
      revision: 4,
      conflict: false,
    };

    expect(receiveSaved(state, { bio: "Typing" }, 4, equalBio)).toBe(state);
  });

  it("ignores an older query revision after a newer save has settled", () => {
    const state = initialEditState<Draft>({ bio: "Newly saved" }, 4);
    expect(receiveSaved(state, { bio: "Previous save" }, 3, equalBio)).toBe(
      state,
    );
  });

  it("marks a rejected stale save as a conflict without clearing input", () => {
    const state = {
      value: { bio: "Typing" },
      baseline: { bio: "Old" },
      revision: 2,
      conflict: false,
    };

    expect(markConflict(state)).toEqual({ ...state, conflict: true });
  });

  it("moves an entry and leaves out-of-range moves unchanged", () => {
    expect(moveSelected(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveSelected(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveSelected(["a", "b", "c"], 0, 3)).toEqual(["a", "b", "c"]);
    const original = ["a", "b"];
    moveSelected(original, 0, 1);
    expect(original).toEqual(["a", "b"]);
  });
});
