/**
 * Community stats section for the Resonance landing page.
 *
 * Renders as a React Server Component. Displays key platform metrics
 * in a horizontal layout with large numbers and descriptive labels.
 *
 * Fetches the live total post count from Convex.
 */

import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function StatsSection() {
  const totalPosts = await fetchQuery(api.posts.countPosts, {});

  const stats = [
    { label: "Published Posts", value: totalPosts },
    { label: "Active Writers", value: "Growing" },
    { label: "Conversations", value: "Daily" },
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 fill-mode-both border border-primary/5 bg-gradient-to-br from-muted/20 via-muted/10 to-primary/5 p-8 sm:p-12 lg:p-16">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              A growing community
            </h2>
            <p className="text-lg text-muted-foreground max-w-[50ch] mx-auto">
              Join writers and readers building something meaningful together.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ${index === 0 ? "delay-0" : index === 1 ? "delay-150" : "delay-300"} fill-mode-both text-center`}
              >
                <div className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-primary mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground uppercase tracking-widest font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
