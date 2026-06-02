/**
 * Hero section for the Resonance landing page.
 *
 * Renders as a React Server Component. Features a gradient background with
 * decorative blur elements, a bold headline, tagline, and auth-aware CTA
 * buttons via the existing `AuthCTA` client component.
 *
 * Entrance animations use `tw-animate-css` utilities with staggered delays
 * on child elements.
 */

import { AuthCTA } from "@/components/web/AuthCTA";

export function HeroSection() {
  return (
    <section className="pt-24 pb-20 sm:pb-24">
      <div className="relative border border-primary/5 bg-gradient-to-br from-muted/20 via-muted/10 to-primary/5 p-8 sm:p-12 lg:p-16 overflow-hidden">
        {/* Decorative ambient blobs */}
        <div className="absolute -top-100 -right-50 w-20 h-240 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/2 rounded-full blur-3xl" />

        <div className="relative z-10">
          <p className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 fill-mode-both text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
            Write · Share · Connect
          </p>
          <h1 className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
            Where ideas
            <br />
            find their echo
          </h1>
          <p className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both text-lg sm:text-xl text-muted-foreground max-w-[50ch] leading-relaxed">
            A space for thoughtful writing, sharing ideas, and engaging with a
            community of curious minds.
          </p>
          <AuthCTA className="mt-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both" />
        </div>
      </div>
    </section>
  );
}
