import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Post",
  description:
    "Draft a deep dive, share a quick update, or capture a fleeting thought to share with the Resonance community.",
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
