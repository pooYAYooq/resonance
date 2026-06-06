import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

/**
 * Create a Better Auth instance that is compatible with Convex.
 *
 * This function takes a Convex context and returns a Better Auth instance
 * that is configured to use the Convex database and Convex authentication
 * plugin.
 *
 * @param ctx - The Convex context to use.
 * @returns A Better Auth instance that is compatible with Convex.
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = getRequiredEnv("SITE_URL", process.env.SITE_URL);

  const socialProviders: Record<
    string,
    { clientId: string; clientSecret: string }
  > = {};

  const authGoogleId = process.env.AUTH_GOOGLE_ID;
  const authGoogleSecret = process.env.AUTH_GOOGLE_SECRET;
  if (authGoogleId && authGoogleSecret) {
    socialProviders.google = {
      clientId: authGoogleId,
      clientSecret: authGoogleSecret,
    };
  }

  const authGithubId = process.env.AUTH_GITHUB_ID;
  const authGithubSecret = process.env.AUTH_GITHUB_SECRET;
  if (authGithubId && authGithubSecret) {
    socialProviders.github = {
      clientId: authGithubId,
      clientSecret: authGithubSecret,
    };
  }

  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    // Configure simple, non-verified email/password to get started
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    ...(Object.keys(socialProviders).length > 0 && { socialProviders }),
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
    ],
  });
};
