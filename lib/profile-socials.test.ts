import { describe, expect, it } from "vitest";
import { normalizeSocialProfiles } from "./profile-socials";

const channel = `UC${"a".repeat(22)}`;

describe("normalizeSocialProfiles", () => {
  it("canonicalizes approved profile URLs", () => {
    expect(
      normalizeSocialProfiles({ instagram: "https://www.instagram.com/ada/" }),
    ).toEqual({ ok: true, value: { instagram: "https://instagram.com/ada" } });
    expect(
      normalizeSocialProfiles({
        x: "https://www.twitter.com/ada?utm_source=test#top",
      }),
    ).toEqual({ ok: true, value: { x: "https://x.com/ada" } });
    expect(
      normalizeSocialProfiles({
        linkedin: "https://www.linkedin.com/in/ada-b/",
      }),
    ).toEqual({
      ok: true,
      value: { linkedin: "https://linkedin.com/in/ada-b" },
    });
    expect(
      normalizeSocialProfiles({ behance: "https://www.behance.net/ada" }),
    ).toEqual({ ok: true, value: { behance: "https://behance.net/ada" } });
    expect(
      normalizeSocialProfiles({ youtube: "https://www.youtube.com/@ada" }),
    ).toEqual({ ok: true, value: { youtube: "https://youtube.com/@ada" } });
    expect(
      normalizeSocialProfiles({
        youtube: `https://youtube.com/channel/${channel}`,
      }),
    ).toEqual({
      ok: true,
      value: { youtube: `https://youtube.com/channel/${channel}` },
    });
  });

  it("returns an empty object when no profile is provided", () => {
    expect(normalizeSocialProfiles({})).toEqual({ ok: true, value: {} });
  });

  it.each([
    "javascript:alert(1)",
    "http://instagram.com/ada",
    "https://instagram.com.evil.test/ada",
    "https://ada:secret@instagram.com/ada",
    "https://instagram.com:444/ada",
    "https://instagram.com/../ada",
    "https://instagram.com/%2e%2e/ada",
    "https://instagram.com/a%2fb",
    "https://instagram.com/a\\b",
    "https://instagram.com/ada\n",
    "https://instagram.com/explore",
  ])("rejects unsafe profile destination %s", (url) => {
    expect(normalizeSocialProfiles({ instagram: url }).ok).toBe(false);
  });

  it("rejects wrong hosts, missing paths, and reserved routes", () => {
    expect(
      normalizeSocialProfiles({ instagram: "https://facebook.com/ada" }).ok,
    ).toBe(false);
    expect(
      normalizeSocialProfiles({ instagram: "https://instagram.com" }).ok,
    ).toBe(false);
    expect(
      normalizeSocialProfiles({ behance: "https://behance.net/gallery" }).ok,
    ).toBe(false);
    expect(normalizeSocialProfiles({ x: "https://x.com/home" }).ok).toBe(false);
    expect(normalizeSocialProfiles({ x: "https://x.com/settings" }).ok).toBe(
      false,
    );
    expect(
      normalizeSocialProfiles({ linkedin: "https://linkedin.com/company/ada" })
        .ok,
    ).toBe(false);
  });

  it("enforces platform handle rules", () => {
    expect(
      normalizeSocialProfiles({ x: `https://x.com/${"a".repeat(16)}` }).ok,
    ).toBe(false);
    expect(
      normalizeSocialProfiles({
        instagram: `https://instagram.com/${"a".repeat(31)}`,
      }).ok,
    ).toBe(false);
    expect(
      normalizeSocialProfiles({ youtube: "https://youtube.com/@ab" }).ok,
    ).toBe(false);
    expect(
      normalizeSocialProfiles({ youtube: "https://youtube.com/watch?v=abc" })
        .ok,
    ).toBe(false);
    expect(
      normalizeSocialProfiles({
        youtube: `https://youtube.com/channel/${"a".repeat(24)}`,
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown platforms and overlong values", () => {
    expect(
      normalizeSocialProfiles({ twitter: "https://x.com/ada" } as never).ok,
    ).toBe(false);
    expect(
      normalizeSocialProfiles({
        instagram: `https://instagram.com/${"a".repeat(2049)}`,
      }).ok,
    ).toBe(false);
  });
});
