import { describe, expect, it } from "vitest";
import { getProfileCountryName } from "./profile-countries";

describe("getProfileCountryName", () => {
  it("resolves a stored code to its display name", () => {
    expect(getProfileCountryName("DK")).toBe("Denmark");
    expect(getProfileCountryName("US")).toBe("United States");
  });

  it("accepts a lower-case spelling of the code", () => {
    expect(getProfileCountryName("dk")).toBe("Denmark");
  });

  it("returns null for null, empty, and unknown codes", () => {
    expect(getProfileCountryName(null)).toBeNull();
    expect(getProfileCountryName("")).toBeNull();
    expect(getProfileCountryName("ZZ")).toBeNull();
  });
});
