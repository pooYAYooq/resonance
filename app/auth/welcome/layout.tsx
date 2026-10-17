import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome",
  description: "A quick hello and where to make your username your own.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
