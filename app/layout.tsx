import type { Metadata } from "next";
import { Neuton, Work_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ConvexClientProvider } from "@/components/web/ConvexClientProvider";
import { AuthoringExitProvider } from "@/components/web/AuthoringExitProvider";
import { Toaster } from "@/components/ui/sonner";
import { SITE_NAME, SITE_DESCRIPTION, getSiteUrl } from "@/lib/constants/seo";

/**
 * Two-family system: Work Sans is the product voice across the app and the
 * published body; Neuton is the published accent, used only for post headings
 * (reader and Review titles plus in-body H2-H6). `--font-mono` stays on the
 * deferred monospace decision.
 */
const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
});

const neuton = Neuton({
  subsets: ["latin"],
  variable: "--font-neuton",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    template: `%s | ${SITE_NAME}`,
    default: SITE_NAME,
  },
  description: SITE_DESCRIPTION,
  keywords: ["blog", "writing", "stories", "ideas", "community"],
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("font-sans", workSans.variable, neuton.variable)}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConvexClientProvider>
            <AuthoringExitProvider>{children}</AuthoringExitProvider>
          </ConvexClientProvider>
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
