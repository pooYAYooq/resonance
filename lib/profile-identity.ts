import { PROFILE_COUNTRIES } from "./constants/profile-countries";
import {
  normalizeSocialProfiles,
  type SocialProfiles,
} from "./profile-socials";

export {
  MAX_PROFILE_URL_CODE_POINTS,
  SOCIAL_PLATFORMS,
  normalizeSocialProfiles,
  type SocialPlatform,
  type SocialProfiles,
  type SocialProfilesResult,
} from "./profile-socials";

export const MAX_PROFILE_NAME_CODE_POINTS = 30;
export const MAX_PROFILE_BIO_CODE_POINTS = 1000;
export const MAX_SELECTED_POSTS = 9;

export type JoinDateDisplay = "calendar" | "relative";

export type IdentityInput = {
  displayName: string;
  bio: string;
  countryCode: string | null;
  socialProfiles: SocialProfiles;
  joinDateDisplay: JoinDateDisplay;
};

export type IdentityResult =
  | { ok: true; value: IdentityInput }
  | { ok: false; field: keyof IdentityInput; message: string };

const COUNTRY_CODES = new Set(PROFILE_COUNTRIES.map((entry) => entry.code));
const JOIN_DATE_DISPLAYS = new Set<JoinDateDisplay>(["calendar", "relative"]);

/** Counts Unicode code points rather than UTF-16 units. */
export function countCodePoints(value: string): number {
  return Array.from(value).length;
}

/**
 * Normalizes author-supplied identity into the stored shape. Optional values
 * are trimmed to empty/null rather than rejected, and each invalid field
 * reports itself so the editor can attach the message to the right control.
 */
export function normalizeProfileIdentity(input: IdentityInput): IdentityResult {
  const displayName =
    typeof input?.displayName === "string" ? input.displayName.trim() : "";
  if (displayName.length === 0) {
    return { ok: false, field: "displayName", message: "Add a display name." };
  }
  if (countCodePoints(displayName) > MAX_PROFILE_NAME_CODE_POINTS) {
    return {
      ok: false,
      field: "displayName",
      message: `Use at most ${MAX_PROFILE_NAME_CODE_POINTS} characters.`,
    };
  }

  const bio =
    typeof input?.bio === "string"
      ? input.bio.replace(/\r\n?/g, "\n").trim()
      : "";
  if (countCodePoints(bio) > MAX_PROFILE_BIO_CODE_POINTS) {
    return {
      ok: false,
      field: "bio",
      message: `Use at most ${MAX_PROFILE_BIO_CODE_POINTS} characters.`,
    };
  }

  const countryCode = input?.countryCode ?? null;
  if (countryCode !== null && !COUNTRY_CODES.has(countryCode)) {
    return {
      ok: false,
      field: "countryCode",
      message: "Choose a country from the list.",
    };
  }

  if (!JOIN_DATE_DISPLAYS.has(input?.joinDateDisplay)) {
    return {
      ok: false,
      field: "joinDateDisplay",
      message: "Choose a join-date style.",
    };
  }

  const socials = normalizeSocialProfiles(input?.socialProfiles ?? {});
  if (!socials.ok) {
    return { ok: false, field: "socialProfiles", message: socials.message };
  }

  return {
    ok: true,
    value: {
      displayName,
      bio,
      countryCode,
      socialProfiles: socials.value,
      joinDateDisplay: input.joinDateDisplay,
    },
  };
}
