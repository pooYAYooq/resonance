import { describe, expect, it } from "vitest";
import { PROFILE_COUNTRIES } from "./constants/profile-countries";
import {
  MAX_PROFILE_BIO_CODE_POINTS,
  MAX_PROFILE_NAME_CODE_POINTS,
  normalizeProfileIdentity,
  type IdentityInput,
} from "./profile-identity";

const base: IdentityInput = {
  displayName: "Ada",
  bio: "",
  countryCode: null,
  socialProfiles: {},
  joinDateDisplay: "calendar",
};

describe("normalizeProfileIdentity", () => {
  it("accepts 30 Unicode code points and rejects 31 without truncating", () => {
    const accepted = normalizeProfileIdentity({
      ...base,
      displayName: "😀".repeat(30),
    });
    expect(accepted).toEqual({
      ok: true,
      value: { ...base, displayName: "😀".repeat(30) },
    });
    expect(
      normalizeProfileIdentity({ ...base, displayName: "😀".repeat(31) }),
    ).toEqual({
      ok: false,
      field: "displayName",
      message: "Use at most 30 characters.",
    });
  });
  it("trims optional text and preserves paragraph breaks", () => {
    expect(
      normalizeProfileIdentity({
        ...base,
        displayName: "  Ada  ",
        bio: "  First\n\nSecond  ",
      }),
    ).toEqual({
      ok: true,
      value: { ...base, displayName: "Ada", bio: "First\n\nSecond" },
    });
  });

  it("clears optional fields to null and an empty profile map", () => {
    expect(
      normalizeProfileIdentity({ ...base, bio: "   ", countryCode: null }),
    ).toEqual({ ok: true, value: { ...base, bio: "" } });
  });

  it("counts bio code points instead of UTF-16 units", () => {
    expect(
      normalizeProfileIdentity({
        ...base,
        bio: "😀".repeat(MAX_PROFILE_BIO_CODE_POINTS),
      }).ok,
    ).toBe(true);
    expect(
      normalizeProfileIdentity({
        ...base,
        bio: "😀".repeat(MAX_PROFILE_BIO_CODE_POINTS + 1),
      }).ok,
    ).toBe(false);
  });

  it("rejects a blank or overlong name", () => {
    const blank = normalizeProfileIdentity({ ...base, displayName: "   " });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.field).toBe("displayName");
    expect(
      normalizeProfileIdentity({
        ...base,
        displayName: "a".repeat(MAX_PROFILE_NAME_CODE_POINTS + 1),
      }).ok,
    ).toBe(false);
  });

  it("accepts every approved country code and rejects unknown ones", () => {
    for (const { code } of PROFILE_COUNTRIES) {
      expect(normalizeProfileIdentity({ ...base, countryCode: code }).ok).toBe(
        true,
      );
    }
    expect(normalizeProfileIdentity({ ...base, countryCode: "ZZ" }).ok).toBe(
      false,
    );
    expect(normalizeProfileIdentity({ ...base, countryCode: "zz" }).ok).toBe(
      false,
    );
  });

  it("does not offer or accept territory and non-country codes", () => {
    const removedCodes = [
      "AS",
      "AI",
      "AQ",
      "AW",
      "BM",
      "BQ",
      "BV",
      "IO",
      "KY",
      "CX",
      "CC",
      "CW",
      "FK",
      "FO",
      "GF",
      "PF",
      "TF",
      "GI",
      "GL",
      "GP",
      "GU",
      "GG",
      "HM",
      "HK",
      "IM",
      "JE",
      "MO",
      "MQ",
      "YT",
      "MS",
      "NC",
      "NF",
      "MP",
      "PN",
      "PR",
      "RE",
      "BL",
      "SH",
      "MF",
      "PM",
      "SX",
      "GS",
      "SJ",
      "TK",
      "TC",
      "UM",
      "VG",
      "VI",
      "WF",
      "AX",
      "EH",
    ];
    for (const code of removedCodes) {
      expect(PROFILE_COUNTRIES.some((entry) => entry.code === code)).toBe(
        false,
      );
      expect(normalizeProfileIdentity({ ...base, countryCode: code })).toEqual({
        ok: false,
        field: "countryCode",
        message: "Choose a country from the list.",
      });
    }
  });

  it.each(["CK", "NU", "VA", "TW", "IR", "TR"])(
    "continues to accept retained country code %s",
    (countryCode) => {
      expect(normalizeProfileIdentity({ ...base, countryCode }).ok).toBe(true);
    },
  );

  it("validates social profiles through the platform rules", () => {
    expect(
      normalizeProfileIdentity({
        ...base,
        socialProfiles: { instagram: "https://instagram.com/ada" },
      }),
    ).toEqual({
      ok: true,
      value: {
        ...base,
        socialProfiles: { instagram: "https://instagram.com/ada" },
      },
    });
    const invalid = normalizeProfileIdentity({
      ...base,
      socialProfiles: { instagram: "http://instagram.com/ada" },
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.field).toBe("socialProfiles");
  });

  it("rejects an unknown join-date display", () => {
    expect(
      normalizeProfileIdentity({
        ...base,
        // @ts-expect-error runtime guard against an untyped caller
        joinDateDisplay: "absolute",
      }).ok,
    ).toBe(false);
  });
});
