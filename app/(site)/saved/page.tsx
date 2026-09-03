import { SavedSection } from "./_components/SavedSection";

export default function SavedRoute() {
  return (
    <div className="space-y-6 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Saved posts</h1>
      <SavedSection />
    </div>
  );
}
