import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your Resonance account to start sharing your stories.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
