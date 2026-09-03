import { PublishedSection } from "../_components/PublishedSection";

export default function DashboardPublishedRoute() {
  return (
    <section aria-labelledby="my-posts-title" className="space-y-6">
      <h1 id="my-posts-title" className="text-2xl font-semibold">
        My Posts
      </h1>
      <PublishedSection />
    </section>
  );
}
