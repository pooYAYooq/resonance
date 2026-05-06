/**
 * Next.js runtime configuration.
 * Defines allowed external image sources for Next.js built-in image optimization.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/images#remote-images
 */
import type { NextConfig } from "next";

/**
 * Static, environment-independent remote image patterns.
 * These are allowlisted CDNs that serve fixed image sources for the app,
 * separated from dynamic Convex patterns to avoid env var dependency for unchanging sources.
 */
const basePatterns = [
  {
    protocol: "https" as const, // Cast to literal type to satisfy Next.js RemotePattern protocol type requirement
    hostname: "w.wallhaven.cc",
    port: "", // Empty string matches all ports for this hostname
    pathname: "/full/**", // Matches full-resolution wallpaper image paths from Wallhaven CDN
  },
];

/**
 * Dynamically extracted Convex deployment hostname for image remote patterns.
 * Derived from NEXT_PUBLIC_CONVEX_URL to avoid hardcoding deployment-specific URLs,
 * ensuring the config works across dev, staging, and production environments automatically.
 */
let convexHostname: string | undefined;
if (process.env.NEXT_PUBLIC_CONVEX_URL) {
  try {
    // Parse the Convex URL to extract only the hostname, ignoring path/query params
    convexHostname = new URL(process.env.NEXT_PUBLIC_CONVEX_URL).hostname;
  } catch {
    // Warn (not throw) if the env var is malformed to avoid breaking the build
    console.warn(
      "Invalid NEXT_PUBLIC_CONVEX_URL; skipping Convex hostname in Next.js image remotePatterns.",
    );
  }
}

/**
 * Next.js configuration object.
 * Configures image optimization to allow remote images from:
 * 1. Static allowlisted CDNs (basePatterns: Wallhaven)
 * 2. The active Convex deployment (dynamically derived from env vars)
 *
 * Next.js requires all external image sources to be explicitly allowlisted in
 * `images.remotePatterns` to enable its built-in image optimization and prevent
 * unauthorized external resource loading.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...basePatterns,
      // Conditionally add Convex deployment pattern only if hostname was successfully parsed
      ...(convexHostname
        ? [
            {
              protocol: "https" as const, // Convex deployments always use HTTPS
              hostname: convexHostname,
              port: "", // Empty string matches all ports for the Convex deployment
              pathname: "/**", // Allow all image paths from Convex (e.g. uploaded post images, user avatars)
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
