/**
 * Site-wide footer component.
 *
 * Renders as a React Server Component (no "use client"). The footer is
 * full-width (breaks out of the page content container) but its inner
 * content is constrained to `max-w-7xl` to stay aligned with the Navbar
 * and page grid.
 *
 * Marketing pages show the full brand and navigation treatment; reader pages
 * keep only the compact copyright bar.
 */
import Link from "next/link";
import { SITE_NAME, QUICK_LINKS, COPYRIGHT_TEXT } from "@/lib/constants/footer";
import { FooterCTA } from "./FooterCTA";

export function Footer({
  variant = "legacy",
}: {
  variant?: "compact" | "legacy" | "marketing";
}) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-background">
      {variant !== "compact" && (
        <div className="border-t border-border w-full">
          <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 py-12 md:py-16">
            <div className="flex flex-col md:flex-row justify-between gap-10 md:gap-16">
              <div className="flex flex-col gap-4 md:max-w-sm">
                <span className="text-2xl font-extrabold tracking-tight text-primary">
                  {SITE_NAME}
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A space for thoughtful writing, sharing ideas, and engaging
                  with a community of curious minds.
                </p>
              </div>
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
              {variant === "legacy" && <FooterCTA />}
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-border w-full" />
      <div
        className={`max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 ${
          variant === "legacy" ? "py-8" : "py-6"
        }`}
      >
        <p className="text-xs text-muted-foreground text-center">
          {COPYRIGHT_TEXT(currentYear)}
        </p>
      </div>
    </footer>
  );
}
