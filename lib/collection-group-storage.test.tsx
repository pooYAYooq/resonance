import { beforeEach, describe, expect, it } from "vitest";
import {
  collectionGroupStorageKey,
  readCollapsedGroups,
  writeCollapsedGroups,
} from "./collection-group-storage";

describe("collection group storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("keys state per signed-in user and collection", () => {
    expect(collectionGroupStorageKey("user-1", "saved")).toBe(
      "resonance:collection-groups:user-1:saved",
    );
    expect(collectionGroupStorageKey("user-1", "liked")).toBe(
      "resonance:collection-groups:user-1:liked",
    );
  });

  it("round-trips collapsed group keys and ignores malformed values", () => {
    const key = collectionGroupStorageKey("user-1", "saved");

    writeCollapsedGroups(key, new Set(["today", "earlier"]));
    expect([...readCollapsedGroups(key)]).toEqual(["today", "earlier"]);

    sessionStorage.setItem(key, "not json");
    expect(readCollapsedGroups(key).size).toBe(0);

    sessionStorage.setItem(key, JSON.stringify(["today", 1, null]));
    expect([...readCollapsedGroups(key)]).toEqual(["today"]);
  });

  it("does nothing without a storage key", () => {
    expect(readCollapsedGroups(undefined).size).toBe(0);
    expect(() =>
      writeCollapsedGroups(undefined, new Set(["today"])),
    ).not.toThrow();
    expect(sessionStorage.length).toBe(0);
  });
});
