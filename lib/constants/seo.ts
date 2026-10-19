/**
 * SEO constants and helpers for the Resonance site.
 *
 * Centralizes site-wide metadata values and utility functions used by
 * Next.js metadata exports across the application.
 */

import { SITE_NAME } from "./footer";

export { SITE_NAME };

/** Default site description used for meta tags and Open Graph. */
export const SITE_DESCRIPTION =
  "Resonance is a blog platform for sharing thoughts, ideas, and stories that echo." as const;

/**
 * Returns the publicly accessible base URL of the Next.js app.
 *
 * Reads from `NEXT_PUBLIC_SITE_URL`. Falls back to `http://localhost:3000`
 * when the variable is not defined (e.g. local development).
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Truncates text to a safe length for HTML `meta description` tags.
 *
 * Strips newlines and extra whitespace, then trims to the nearest word
 * boundary so the result never exceeds `maxLength`.
 *
 * @param text       - Raw text to truncate (e.g. a post body).
 * @param maxLength  - Maximum character count (default 155).
 * @returns A clean, truncated string suitable for `description` meta fields.
 */
export function truncateForDescription(
  text: string,
  maxLength: number = 155,
): string {
  const cleaned = text.replace(/\s+/g, " ").replace(/\n/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  // If there's no space, just hard-cut; otherwise cut at the last space
  // so we don't end mid-word.
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + "…" : truncated + "…";
}

/**
 * Builds a search-friendly description for a public author page.
 *
 * Collapses the raw bio's whitespace and trims it; an empty bio falls back to
 * the author tagline. Otherwise the bio is bounded to `maxLength` Unicode code
 * points, so an astral character crossing the boundary is never split into a
 * lone surrogate.
 *
 * @param bio         - Raw bio text, or null when the author has none.
 * @param displayName - Resolved display name used for the fallback tagline.
 * @param maxLength   - Maximum code points (default 160).
 * @returns A clean, bounded description suitable for a `description` meta field.
 */
export function boundProfileDescription(
  bio: string | null,
  displayName: string,
  maxLength: number = 160,
): string {
  const collapsed = (bio ?? "").replace(/\s+/g, " ").trim();
  if (collapsed.length > 0) {
    return Array.from(collapsed).slice(0, maxLength).join("");
  }
  return `Posts by ${displayName} on Resonance.`;
}
