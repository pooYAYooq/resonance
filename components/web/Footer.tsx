/**
 * Site-wide footer component.
 *
 * Renders as a React Server Component (no "use client"). The footer is
 * full-width (breaks out of the page content container) but its inner
 * content is constrained to `max-w-7xl` to stay aligned with the Navbar
 * and page grid.
 *
 * Sections:
 * - Brand column: site name (primary color), tagline
 * - Quick links: vertical navigation list
 * - CTA card: auth-aware gradient card via `<FooterCTA />` (Client Component)
 *   showing "Write a post" when authenticated, "Get Started" otherwise
 * - Bottom bar: full-width border + centered copyright
 */
import Link from "next/link";
import { SITE_NAME, QUICK_LINKS, COPYRIGHT_TEXT } from "@/lib/constants/footer";
import { FooterCTA } from "./FooterCTA";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-background">
      {/* Full-width top separator */}
      <div className="border-t border-border w-full" />

      {/* Main content */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 py-12 md:py-16">
        <div className="flex flex-col md:flex-row justify-between gap-10 md:gap-16">
          {/* Brand */}
          <div className="flex flex-col gap-4 md:max-w-sm">
            <span className="text-2xl font-extrabold tracking-tight text-primary">
              {SITE_NAME}
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A space for thoughtful writing, sharing ideas, and engaging with a
              community of curious minds.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-4">
            <span className="text-sm font-semibold text-foreground">
              Explore
            </span>
            <ul className="flex flex-col gap-2.5">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Card */}
          <FooterCTA />
        </div>
      </div>

      {/* Full-width bottom separator */}
      <div className="border-t border-border w-full" />

      {/* Copyright */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 py-8">
        <p className="text-xs text-muted-foreground text-center">
          {COPYRIGHT_TEXT(currentYear)}
        </p>
      </div>
    </footer>
  );
}
