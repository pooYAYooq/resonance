/**
 * Username spelling rules shared by the editor and the backend.
 *
 * `styled` is what people see. `canonical` is its lowercase lookup key. Both
 * describe one username, so every write stores the pair derived here.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/** Exact, case-insensitive names no account may claim. */
export const RESERVED_USERNAMES: readonly string[] = [
  "admin",
  "administrator",
  "api",
  "help",
  "login",
  "me",
  "mod",
  "moderator",
  "official",
  "resonance",
  "root",
  "security",
  "setting",
  "settings",
  "staff",
  "support",
  "system",
  "team",
];

const RESERVED = new Set(RESERVED_USERNAMES);
const ALLOWED = /^[A-Za-z0-9_]+$/;
const HAS_LETTER = /[A-Za-z]/;

export type UsernameResult =
  | { ok: true; styled: string; canonical: string }
  | { ok: false; message: string };

/** Normalizes one user-supplied spelling, or explains the first rule it broke. */
export function normalizeUsername(input: string): UsernameResult {
  const styled = typeof input === "string" ? input.trim() : "";
  if (styled.length === 0) {
    return { ok: false, message: "Choose a username." };
  }
  if (!ALLOWED.test(styled)) {
    return {
      ok: false,
      message: "Use only English letters, numbers, and underscores.",
    };
  }
  if (styled.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false,
      message: `Use at least ${USERNAME_MIN_LENGTH} characters.`,
    };
  }
  if (styled.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Use at most ${USERNAME_MAX_LENGTH} characters.`,
    };
  }
  if (!HAS_LETTER.test(styled)) {
    return { ok: false, message: "Include at least one letter." };
  }
  if (styled.startsWith("_") || styled.endsWith("_")) {
    return {
      ok: false,
      message: "Do not start or end with an underscore.",
    };
  }
  if (styled.includes("__")) {
    return { ok: false, message: "Do not use two underscores in a row." };
  }
  return { ok: true, styled, canonical: styled.toLowerCase() };
}

/** True when a canonical name is reserved by Resonance. */
export function isReservedUsername(canonical: string): boolean {
  return RESERVED.has(canonical.toLowerCase());
}

/** The public profile address for any spelling of a username. */
export function buildProfilePath(username: string): string {
  return `/u/${username.toLowerCase()}`;
}

export const GENERATED_USERNAME_PREFIX = "Reso_";
export const GENERATED_USERNAME_SUFFIX_LENGTH = 10;
/** Letters and digits with l, o, 0, and 1 removed to avoid visual confusion. */
export const GENERATED_USERNAME_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Builds one candidate generated name; the caller checks whether it is free. */
export function buildGeneratedUsername(random: () => number): {
  styled: string;
  canonical: string;
} {
  let suffix = "";
  for (let index = 0; index < GENERATED_USERNAME_SUFFIX_LENGTH; index += 1) {
    const pick = Math.floor(random() * GENERATED_USERNAME_ALPHABET.length);
    const character =
      GENERATED_USERNAME_ALPHABET[
        Math.min(Math.max(pick, 0), GENERATED_USERNAME_ALPHABET.length - 1)
      ];
    suffix += character;
  }
  const styled = `${GENERATED_USERNAME_PREFIX}${suffix}`;
  return { styled, canonical: styled.toLowerCase() };
}
