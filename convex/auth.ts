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

import {
  createClient,
  type AuthFunctions,
  type GenericCtx,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
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
 * Reads a required string from an OAuth profile, throwing a clear error
 * if the field is missing or not a string.
 */
function getRequiredString(
  profile: Record<string, unknown>,
  key: string,
  source: string,
): string {
  const value = profile[key];
  if (typeof value !== "string") {
    throw new Error(
      `Missing required field "${key}" in ${source} OAuth profile`,
    );
  }
  return value;
}

/**
 * Reads a required number from an OAuth profile, throwing a clear error
 * if the field is missing or not a number.
 */
function getRequiredNumber(
  profile: Record<string, unknown>,
  key: string,
  source: string,
): number {
  const value = profile[key];
  if (typeof value !== "number") {
    throw new Error(
      `Missing required field "${key}" in ${source} OAuth profile`,
    );
  }
  return value;
}

/**
 * Reads a nullable string from an OAuth profile, throwing a clear error
 * if the field exists but is not a string or null.
 */
function getNullableString(
  profile: Record<string, unknown>,
  key: string,
  source: string,
): string | null {
  const value = profile[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(
      `Invalid type for "${key}" in ${source} OAuth profile: expected string, got ${typeof value}`,
    );
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
 *
 * The `triggers` callbacks below run in the same transaction as the account
 * write: creation provisions the app profile and a generated username, and
 * deletion retires the account's usernames permanently, rather than depending
 * on a browser callback.
 */
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        await ctx.runMutation(internal.usernames.provisionAccount, {
          authUserId: doc._id,
          name: doc.name ?? null,
          email: doc.email ?? null,
          image: doc.image ?? null,
          createdAt: doc.createdAt,
        });
      },
      onDelete: async (ctx, doc) => {
        await ctx.runMutation(internal.usernames.retireAccount, {
          ownerUserId: doc._id,
        });
      },
    },
  },
});

/** Registered so the Better Auth component can execute the trigger callbacks. */
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

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
        id: getRequiredString(profile, "sub", "Google"),
        name: getRequiredString(profile, "name", "Google"),
        email: getNullableString(profile, "email", "Google"),
        image: getRequiredString(profile, "picture", "Google"),
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
        id: String(getRequiredNumber(profile, "id", "GitHub")),
        // `name` can be null, fall back to `login` (always present).
        name:
          getNullableString(profile, "name", "GitHub") ??
          getRequiredString(profile, "login", "GitHub"),
        email: getNullableString(profile, "email", "GitHub"),
        image: getRequiredString(profile, "avatar_url", "GitHub"),
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
