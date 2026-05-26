import { describe, expect, it } from "vitest";
import { hashUserId } from "./avatar";

describe("hashUserId", () => {
  it("returns a stable hex string for the same input", () => {
    const seed1 = hashUserId("user-123");
    const seed2 = hashUserId("user-123");

    expect(seed1).toBe(seed2);
    expect(seed1).toMatch(/^[0-9a-f]+$/);
    expect(seed1.length).toBeGreaterThanOrEqual(8);
  });

  it("produces different seeds for different inputs", () => {
    const seedA = hashUserId("user-a");
    const seedB = hashUserId("user-b");

    expect(seedA).not.toBe(seedB);
  });

  it("does not expose the raw identifier in the output", () => {
    const seed = hashUserId("k7n9m2p4q8r5t1v3w6x0y2z7");

    expect(seed).not.toContain("k7n9m2p4q8r5t1v3w6x0y2z7");
  });
});
