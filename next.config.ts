/**
 * Next.js runtime configuration.
 * Defines allowed external image sources for Next.js built-in image optimization.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/images#remote-images
 */
import type { NextConfig } from "next";

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
    // Throw if the env var is malformed since this is a required configuration
    throw new Error(
      "Invalid NEXT_PUBLIC_CONVEX_URL: " + process.env.NEXT_PUBLIC_CONVEX_URL,
    );
  }
}

/**
 * Next.js configuration object.
 * Configures image optimization to allow remote images from the active Convex
 * deployment, derived dynamically from env vars.
 *
 * Next.js requires all external image sources to be explicitly allowlisted in
 * `images.remotePatterns` to enable its built-in image optimization and prevent
 * unauthorized external resource loading.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
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
