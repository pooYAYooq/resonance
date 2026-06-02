/**
 * Explore section placeholder for the Resonance landing page.
 *
 * Renders as a React Server Component. Intended to house category browsing,
 * popular tags, or topic discovery in a future iteration.
 *
 * For now, displays a subtle placeholder card inviting exploration.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tag, ArrowRight } from "lucide-react";
import Link from "next/link";

export function ExploreSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 fill-mode-both text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Explore Topics
          </h2>
          <p className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both text-lg text-muted-foreground max-w-[50ch] mx-auto">
            Discover content organized by themes and ideas that resonate with you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Technology", count: "Coming soon" },
            { label: "Design", count: "Coming soon" },
            { label: "Culture", count: "Coming soon" },
            { label: "Science", count: "Coming soon" },
          ].map((category, index) => (
            <Card
              key={category.label}
              className={`animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ${index === 0 ? "delay-0" : index === 1 ? "delay-100" : index === 2 ? "delay-200" : "delay-300"} fill-mode-both transition-all hover:shadow-lg hover:border-primary/20 opacity-60 hover:opacity-100`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    {category.label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  {category.count}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 text-center animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Browse all posts
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
