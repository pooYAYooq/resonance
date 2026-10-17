import { describe, expect, it } from "vitest";
import {
  buildGeneratedUsername,
  buildProfilePath,
  GENERATED_USERNAME_ALPHABET,
  GENERATED_USERNAME_SUFFIX_LENGTH,
  isReservedUsername,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "./username";

describe("normalizeUsername", () => {
  it("derives the canonical form while keeping the chosen styling", () => {
    expect(normalizeUsername("PooYAYooq")).toEqual({
      ok: true,
      styled: "PooYAYooq",
      canonical: "pooyayooq",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUsername("  pooya  ")).toEqual({
      ok: true,
      styled: "pooya",
      canonical: "pooya",
    });
  });

  it.each([
    ["", "Choose a username."],
    ["   ", "Choose a username."],
    ["ab", `Use at least ${USERNAME_MIN_LENGTH} characters.`],
  ])("rejects %j as too short", (input, message) => {
    expect(normalizeUsername(input)).toEqual({ ok: false, message });
  });

  it("rejects an over-length name", () => {
    const input = "a".repeat(USERNAME_MAX_LENGTH + 1);
    expect(normalizeUsername(input)).toEqual({
      ok: false,
      message: `Use at most ${USERNAME_MAX_LENGTH} characters.`,
    });
  });

  it("accepts the maximum length", () => {
    const input = "a".repeat(USERNAME_MAX_LENGTH);
    expect(normalizeUsername(input)).toEqual({
      ok: true,
      styled: input,
      canonical: input,
    });
  });

  it.each([["pooya-k"], ["pooya.k"], ["pooya k"], ["pooya@k"], ["pooyaé"]])(
    "rejects the unsupported character in %j",
    (input) => {
      expect(normalizeUsername(input)).toEqual({
        ok: false,
        message: "Use only English letters, numbers, and underscores.",
      });
    },
  );

  it.each([["12345"], ["___"], ["1_2_3"]])(
    "rejects %j because it has no letter",
    (input) => {
      expect(normalizeUsername(input)).toEqual({
        ok: false,
        message: "Include at least one letter.",
      });
    },
  );

  it.each([["_pooya"], ["pooya_"]])(
    "rejects the edge underscore in %j",
    (input) => {
      expect(normalizeUsername(input)).toEqual({
        ok: false,
        message: "Do not start or end with an underscore.",
      });
    },
  );

  it("rejects consecutive underscores", () => {
    expect(normalizeUsername("pooya__k")).toEqual({
      ok: false,
      message: "Do not use two underscores in a row.",
    });
  });

  it("accepts digits at the start and underscores between characters", () => {
    expect(normalizeUsername("A1234578_9")).toEqual({
      ok: true,
      styled: "A1234578_9",
      canonical: "a1234578_9",
    });
    expect(normalizeUsername("7PK")).toEqual({
      ok: true,
      styled: "7PK",
      canonical: "7pk",
    });
  });
});

describe("reserved names", () => {
  it("matches case-insensitively and exactly", () => {
    expect(isReservedUsername("resonance")).toBe(true);
    expect(isReservedUsername("ADMIN")).toBe(true);
    expect(isReservedUsername("admina")).toBe(false);
    expect(isReservedUsername("pooya")).toBe(false);
  });
});

describe("buildProfilePath", () => {
  it("emits the lowercase canonical address", () => {
    expect(buildProfilePath("PooYAYooq")).toBe("/u/pooyayooq");
  });
});

describe("buildGeneratedUsername", () => {
  it("uses the Reso_ prefix and an unambiguous suffix", () => {
    const generated = buildGeneratedUsername(() => 0.5);
    expect(generated.styled.startsWith("Reso_")).toBe(true);
    expect(generated.styled.slice("Reso_".length)).toHaveLength(
      GENERATED_USERNAME_SUFFIX_LENGTH,
    );
    expect(generated.canonical).toBe(generated.styled.toLowerCase());
  });

  it("never emits a confusable character", () => {
    for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
      const suffix = buildGeneratedUsername(() => value).styled.slice(5);
      for (const character of suffix) {
        expect(GENERATED_USERNAME_ALPHABET).toContain(character);
      }
    }
    expect(GENERATED_USERNAME_ALPHABET).not.toMatch(/[lo01]/);
  });

  it("satisfies the username rules", () => {
    const generated = buildGeneratedUsername(Math.random);
    expect(normalizeUsername(generated.styled)).toEqual({
      ok: true,
      styled: generated.styled,
      canonical: generated.canonical,
    });
  });
});
