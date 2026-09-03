import { LikedSection } from "./_components/LikedSection";

export default function LikedRoute() {
  return (
    <div className="space-y-6 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Liked posts</h1>
      <LikedSection />
    </div>
  );
}
