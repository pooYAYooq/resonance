import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readExpansion, toggleExpansion } from "./notificationExpansion";

describe("notification expansion storage failures", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("expands when storage can be read but setItem fails", () => {
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Storage quota exhausted", "QuotaExceededError");
      });

    toggleExpansion("failed-expansion-write");

    expect(readExpansion("failed-expansion-write")).toBe(true);
    toggleExpansion("failed-expansion-write");
    expect(readExpansion("failed-expansion-write")).toBe(false);
    write.mockRestore();
    window.localStorage.setItem("failed-expansion-write", "expanded");
    expect(readExpansion("failed-expansion-write")).toBe(true);
  });

  it("collapses when storage can be read but removeItem fails", () => {
    window.localStorage.setItem("failed-collapse-write", "expanded");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage write denied", "SecurityError");
    });

    toggleExpansion("failed-collapse-write");

    expect(readExpansion("failed-collapse-write")).toBe(false);
    toggleExpansion("failed-collapse-write");
    expect(readExpansion("failed-collapse-write")).toBe(true);
  });
});
