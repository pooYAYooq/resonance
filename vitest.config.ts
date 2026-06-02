import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["app/**/*.test.ts", "lib/**/*.test.ts", "convex/**/*.test.ts", "schemas/**/*.test.ts"],
    exclude: ["convex/_generated/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
