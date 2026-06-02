/**
 * Features section for the Resonance landing page.
 *
 * Renders as a React Server Component. Displays the platform's key
 * capabilities in a responsive 3-column grid of Card components with
 * hover transitions and staggered entrance animations.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PenLine, Users, MessageSquare } from "lucide-react";

const features = [
  {
    icon: PenLine,
    title: "Writing & Publishing",
    description:
      "Craft beautiful posts with a clean, distraction-free editor. Share your stories, ideas, and expertise with the world.",
  },
  {
    icon: Users,
    title: "Community Engagement",
    description:
      "Build a following of readers who care about your perspective. Discover writers who share your curiosity.",
  },
  {
    icon: MessageSquare,
    title: "Discussion & Comments",
    description:
      "Spark meaningful conversations around your posts. Engage with feedback, questions, and diverse viewpoints.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 fill-mode-both text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Everything you need to share your voice
          </h2>
          <p className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both text-lg text-muted-foreground max-w-[60ch] mx-auto">
            A complete platform for writers who want to publish, grow, and connect.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const delayClass =
              index === 0
                ? "delay-0"
                : index === 1
                  ? "delay-150"
                  : "delay-300";

            return (
              <Card
                key={feature.title}
                className={`animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ${delayClass} fill-mode-both transition-all hover:shadow-lg hover:border-primary/20`}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
