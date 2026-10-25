import { defineApp } from "convex/server";
import { v } from "convex/values";
import betterAuth from "@convex-dev/better-auth/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const app = defineApp({
  env: { AUTH_TRUSTED_ORIGINS: v.optional(v.string()) },
});
app.use(betterAuth);
app.use(rateLimiter);

export default app;
