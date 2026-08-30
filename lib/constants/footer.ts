/**
 * Footer content constants for the Resonance site.
 *
 */

/** Site name displayed in the footer and across the application. */
export const SITE_NAME = "RESONANCE" as const;

/** Quick navigation links shown in the footer. */
export const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Blog", href: "/blog" },
  { label: "Create Post", href: "/create" },
] as const;

/**
 * Generates the copyright text for the current year.
 *
 * @param year - The current year (typically from `new Date().getFullYear()`).
 * @returns A formatted copyright string including the site name.
 */
export function COPYRIGHT_TEXT(year: number): string {
  return `© ${year} ${SITE_NAME}. All rights reserved.`;
}
