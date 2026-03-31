import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        // https://w.wallhaven.cc/full/k7/wallhaven-k7k9j7.jpg
        protocol: "https",
        hostname: "w.wallhaven.cc",
        port: "",
        pathname: "/full/**",
      },
    ],
  },
};

export default nextConfig;
