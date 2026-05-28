/**
 * Footer content constants for the Resonance site.
 *
 * NOTE: Several values in this file are placeholders intended for future
 * replacement (marked with TODO comments). Update them before launch.
 */

/** Site name displayed in the footer and across the application. */
export const SITE_NAME = "RESONANCE" as const;

/** Quick navigation links shown in the footer. */
export const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Blog", href: "/blog" },
  { label: "Create Post", href: "/create" },
] as const;

/** Social media links shown as icon buttons in the footer. */
export const SOCIAL_LINKS = [
  {
    name: "GitHub",
    // TODO: Replace with your actual GitHub repository URL
    href: "https://github.com/your-org/resonance",
    icon: "github" as const,
  },
  {
    name: "Twitter",
    // TODO: Replace with your actual Twitter/X profile URL
    href: "https://twitter.com/your-handle",
    icon: "twitter" as const,
  },
  {
    name: "LinkedIn",
    // TODO: Replace with your actual LinkedIn page URL
    href: "https://linkedin.com/company/your-company",
    icon: "linkedin" as const,
  },
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
