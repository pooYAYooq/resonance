/**
 * Better Auth integration for Convex.
 *
 * Configures and exports Better Auth running inside Convex with optional
 * Google and GitHub OAuth providers. The `SITE_URL` env var (set in the
 * Convex dashboard, not .env.local) is required at runtime.
 *
 * Auth flows: browser refers to Next.js route handlers
 * (app/api/auth/[...all]/route.ts) which delegate to this Convex HTTP
 * endpoint (convex/http.ts).
 */

import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";

/**
 * Reads a required string from the environment, throwing a descriptive
 * error if it is missing or empty.
 *
 * @param name - Env var name for the error message.
 * @param value - The raw env var value (may be undefined).
 * @returns The non-empty value.
 */
function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

/**
 * Minimal shape for a social provider config consumed by Better Auth.
 *
 * Each provider maps its OAuth profile to the standard user fields
 * (`id`, `name`, `email`, `image`) that Better Auth stores.
 */
interface SocialProviderConfig {
  /** OAuth client ID from the provider's developer console. */
  clientId: string;
  /** OAuth client secret from the provider's developer console. */
  clientSecret: string;
  /**
   * Transforms the OAuth provider's profile response into Better Auth's
   * standard user shape with stable identifiers.
   *
   * @param profile - The raw OAuth profile object from the provider.
   * @returns Standard user fields: `id`, `name`, `email` (nullable), `image`.
   */
  mapProfileToUser: (profile: Record<string, unknown>) => {
    id: string;
    name: string;
    email: string | null;
    image: string;
  };
}

/**
 * Wraps the Better Auth component client for use in Convex queries,
 * mutations, and actions.
 *
 * Exposes helpers like `adapter(ctx)` for database access and
 * `getSessionId()` for reading the active session.
 */
export const authComponent = createClient<DataModel>(components.betterAuth);

/**
 * Creates a Better Auth instance wired to the Convex database.
 *
 * Reads `SITE_URL` from Convex dashboard env vars. If `AUTH_GOOGLE_ID`
 * and `AUTH_GOOGLE_SECRET` are set, Google sign-in is enabled. Similarly
 * for `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
 *
 * @param ctx - Convex action/query context used to create a database adapter.
 * @returns A configured Better Auth instance.
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = getRequiredEnv("SITE_URL", process.env.SITE_URL);

  const socialProviders: Record<string, SocialProviderConfig> = {};

  const authGoogleId = process.env.AUTH_GOOGLE_ID;
  const authGoogleSecret = process.env.AUTH_GOOGLE_SECRET;
  if (authGoogleId && authGoogleSecret) {
    /**
     * Google OAuth2 configuration.
     * Uses OIDC standard claims: `sub` as the stable identifier, `picture` for avatar.
     */
    socialProviders.google = {
      clientId: authGoogleId,
      clientSecret: authGoogleSecret,
      mapProfileToUser: (profile: Record<string, unknown>) => ({
        // Google's OIDC endpoint uses `sub` (not `id`) as the stable user identifier.
        id: profile.sub as string,
        name: profile.name as string,
        email: profile.email as string,
        image: profile.picture as string,
      }),
    };
  }

  const authGithubId = process.env.AUTH_GITHUB_ID;
  const authGithubSecret = process.env.AUTH_GITHUB_SECRET;
  if (authGithubId && authGithubSecret) {
    /**
     * GitHub OAuth2 configuration.
     * Uses REST API v3 claims: `id` (numeric, coerced to string), `login` as
     * fallback for `name`, `avatar_url` for the profile image.
     */
    socialProviders.github = {
      clientId: authGithubId,
      clientSecret: authGithubSecret,
      mapProfileToUser: (profile: Record<string, unknown>) => ({
        // GitHub API returns `id` as a number; convert to string for storage.
        id: String(profile.id),
        // `name` can be null, fall back to `login` (always present).
        name: (profile.name as string | null) ?? (profile.login as string),
        email: profile.email as string | null,
        image: profile.avatar_url as string,
      }),
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
    plugins: [convex({ authConfig })],
  });
};
