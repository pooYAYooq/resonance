export const MAX_PROFILE_URL_CODE_POINTS = 2048;

export const SOCIAL_PLATFORMS = [
  "instagram",
  "linkedin",
  "behance",
  "youtube",
  "x",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialProfiles = Partial<Record<SocialPlatform, string>>;

export type SocialProfilesResult =
  | { ok: true; value: SocialProfiles }
  | { ok: false; message: string };

const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const ASCII_SLUG = /^[A-Za-z0-9_-]+$/;
const YOUTUBE_CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;
const YOUTUBE_HANDLE_CHARS = /^[\p{L}\p{M}\p{N}._·-]+$/u;
const YOUTUBE_HANDLE_EDGE = /[\p{L}\p{N}]/u;

const PLATFORM_HOSTS: Record<SocialPlatform, readonly string[]> = {
  instagram: ["instagram.com"],
  linkedin: ["linkedin.com"],
  behance: ["behance.net"],
  youtube: ["youtube.com"],
  x: ["x.com", "twitter.com"],
};

const CANONICAL_HOST: Record<SocialPlatform, string> = {
  instagram: "instagram.com",
  linkedin: "linkedin.com",
  behance: "behance.net",
  youtube: "youtube.com",
  x: "x.com",
};

const RESERVED_HANDLES: Record<SocialPlatform, ReadonlySet<string>> = {
  instagram: new Set([
    "accounts",
    "about",
    "api",
    "developer",
    "direct",
    "explore",
    "legal",
    "p",
    "reel",
    "reels",
    "stories",
    "tv",
    "web",
  ]),
  behance: new Set([
    "about",
    "assets",
    "collections",
    "discover",
    "galleries",
    "gallery",
    "hire",
    "joblist",
    "jobs",
    "search",
    "settings",
  ]),
  x: new Set([
    "about",
    "compose",
    "explore",
    "home",
    "i",
    "intent",
    "login",
    "logout",
    "messages",
    "notifications",
    "search",
    "settings",
    "share",
    "signup",
    "tos",
  ]),
  linkedin: new Set(),
  youtube: new Set(),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Rejects raw input that URL parsing would otherwise normalize into a safe,
 * different destination: controls, backslashes, encoded slashes, and dot path
 * segments. URL parsing strips these, so they are checked before parsing.
 */
function hasUnsafeRawInput(raw: string): boolean {
  return (
    /[\u0000-\u001f\u007f]/.test(raw) ||
    raw.includes("\\") ||
    /%5c/i.test(raw) ||
    /%2f/i.test(raw) ||
    /(?:^|\/)(?:\.|%2e)(?:\.|%2e)?(?:\/|$)/i.test(raw)
  );
}

function hostMatches(platform: SocialPlatform, hostname: string): boolean {
  const bare = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  return PLATFORM_HOSTS[platform].includes(bare);
}

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0);
}

function isYoutubeHandle(handle: string): boolean {
  const points = Array.from(handle);
  if (points.length < 3 || points.length > 30) return false;
  if (!YOUTUBE_HANDLE_CHARS.test(handle)) return false;
  return (
    YOUTUBE_HANDLE_EDGE.test(points[0]) &&
    YOUTUBE_HANDLE_EDGE.test(points[points.length - 1])
  );
}

function normalizeOne(platform: SocialPlatform, raw: string): string | null {
  if (Array.from(raw).length > MAX_PROFILE_URL_CODE_POINTS) return null;
  if (hasUnsafeRawInput(raw)) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.port !== "") return null;
  if (!hostMatches(platform, url.hostname)) return null;
  const parts = pathSegments(url.pathname);
  const base = `https://${CANONICAL_HOST[platform]}`;
  switch (platform) {
    case "instagram":
    case "x": {
      if (parts.length !== 1) return null;
      const handle = parts[0];
      const pattern = platform === "instagram" ? INSTAGRAM_HANDLE : X_HANDLE;
      if (!pattern.test(handle)) return null;
      if (RESERVED_HANDLES[platform].has(handle.toLowerCase())) return null;
      return `${base}/${handle}`;
    }
    case "behance": {
      if (parts.length !== 1) return null;
      const slug = parts[0];
      if (!ASCII_SLUG.test(slug)) return null;
      if (RESERVED_HANDLES.behance.has(slug.toLowerCase())) return null;
      return `${base}/${slug}`;
    }
    case "linkedin": {
      if (parts.length !== 2 || parts[0].toLowerCase() !== "in") return null;
      const slug = parts[1];
      if (!ASCII_SLUG.test(slug)) return null;
      return `${base}/in/${slug}`;
    }
    case "youtube": {
      if (parts.length === 1 && parts[0].startsWith("@")) {
        const handle = parts[0].slice(1);
        return isYoutubeHandle(handle) ? `${base}/@${handle}` : null;
      }
      if (parts.length === 2 && parts[0] === "channel") {
        return YOUTUBE_CHANNEL.test(parts[1])
          ? `${base}/channel/${parts[1]}`
          : null;
      }
      return null;
    }
  }
}

/**
 * Validates and canonicalizes optional social profile URLs. Empty values are
 * treated as absent so a cleared field is allowed; unsafe or unsupported values
 * fail rather than being normalized into a different destination.
 */
export function normalizeSocialProfiles(
  input: SocialProfiles,
): SocialProfilesResult {
  if (!isRecord(input)) {
    return { ok: false, message: "Invalid social profiles." };
  }
  for (const key of Object.keys(input)) {
    if (!(SOCIAL_PLATFORMS as readonly string[]).includes(key)) {
      return { ok: false, message: "Unknown social platform." };
    }
  }
  const value: SocialProfiles = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const raw = input[platform];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") {
      return { ok: false, message: `Invalid ${platform} profile URL.` };
    }
    if (raw.trim().length === 0) continue;
    const normalized = normalizeOne(platform, raw);
    if (normalized === null) {
      return { ok: false, message: `Invalid ${platform} profile URL.` };
    }
    value[platform] = normalized;
  }
  return { ok: true, value };
}
